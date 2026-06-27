"""Provider-neutral chat adapter contracts for Abby."""
from __future__ import annotations

import json
import hashlib
import time
from dataclasses import dataclass, field
from typing import Any, AsyncGenerator, Callable, cast

import httpx

from app.routing.claude_client import ClaudeClient
from app.routing.provider_profiles import ProviderProfile


LatencyLogger = Callable[..., None]
EstimateTokens = Callable[[str], int]
NsToMs = Callable[[Any], float | None]


@dataclass(frozen=True)
class ChatAdapterRequest:
    system_prompt: str
    message: str
    history: list[dict[str, str]] = field(default_factory=list)
    temperature: float = 0.1
    max_output_tokens: int | None = None


@dataclass(frozen=True)
class ChatAdapterResponse:
    reply: str
    provider: str
    transport: str
    model: str
    tokens_in: int = 0
    tokens_out: int = 0
    cost_usd: float = 0.0
    latency_ms: float = 0.0
    request_hash: str = ""
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ChatStreamEvent:
    kind: str
    token: str = ""
    payload: dict[str, Any] = field(default_factory=dict)


class ChatAdapterError(RuntimeError):
    """Classified provider failure suitable for route fallback metadata."""

    def __init__(
        self,
        message: str,
        *,
        error_class: str,
        status_code: int = 503,
        retryable: bool = False,
    ) -> None:
        super().__init__(message)
        self.error_class = error_class
        self.status_code = status_code
        self.retryable = retryable


class OllamaChatAdapter:
    """Ollama `/api/chat` adapter for local Abby chat/RAG profiles."""

    def __init__(
        self,
        *,
        profile: ProviderProfile,
        client: httpx.AsyncClient,
        default_num_predict: int,
        keep_alive_seconds: int,
        timeout_seconds: int,
        log_latency: LatencyLogger | None = None,
        estimate_tokens: EstimateTokens | None = None,
        ns_to_ms: NsToMs | None = None,
        max_retries: int = 2,
    ) -> None:
        self.profile = profile
        self.client = client
        self.default_num_predict = default_num_predict
        self.keep_alive_seconds = keep_alive_seconds
        self.timeout_seconds = timeout_seconds
        self.log_latency = log_latency
        self.estimate_tokens = estimate_tokens or (lambda text: max(1, len(text) // 4))
        self.ns_to_ms = ns_to_ms or (lambda value: None)
        self.max_retries = max_retries

    async def chat(self, request: ChatAdapterRequest) -> ChatAdapterResponse:
        started = time.perf_counter()
        messages = [{"role": "system", "content": request.system_prompt}]
        messages.extend(request.history[-10:])
        messages.append({"role": "user", "content": request.message})
        num_predict = request.max_output_tokens or self.default_num_predict
        base_url = self.profile.base_url or ""

        for attempt in range(self.max_retries + 1):
            # First attempt gets longer because cold Ollama model loads can take
            # much longer than steady-state inference.
            attempt_timeout = 180 if attempt == 0 else min(60, self.timeout_seconds)
            attempt_started = time.perf_counter()
            try:
                response = await self.client.post(
                    f"{base_url}/api/chat",
                    json={
                        "model": self.profile.model,
                        "messages": messages,
                        "stream": False,
                        "think": False,
                        "keep_alive": self.keep_alive_seconds,
                        "options": {
                            "temperature": request.temperature,
                            "num_predict": num_predict,
                        },
                    },
                    timeout=attempt_timeout,
                )
                response.raise_for_status()
                data = response.json()
                reply = data.get("message", {}).get("content", "")
                total_ms = (time.perf_counter() - started) * 1000
                attempt_ms = (time.perf_counter() - attempt_started) * 1000
                if self.log_latency is not None:
                    self.log_latency(
                        "abby_ollama_call",
                        model=self.profile.model,
                        base_url=base_url,
                        attempts=attempt + 1,
                        total_ms=total_ms,
                        attempt_ms=attempt_ms,
                        prompt_chars=len(request.system_prompt),
                        prompt_tokens_est=self.estimate_tokens(request.system_prompt),
                        message_chars=len(request.message),
                        num_predict=num_predict,
                        history_turns=len(request.history[-10:]),
                        response_chars=len(reply),
                        load_ms=self.ns_to_ms(data.get("load_duration")),
                        prompt_eval_ms=self.ns_to_ms(data.get("prompt_eval_duration")),
                        eval_ms=self.ns_to_ms(data.get("eval_duration")),
                        ollama_total_ms=self.ns_to_ms(data.get("total_duration")),
                        prompt_eval_count=data.get("prompt_eval_count"),
                        eval_count=data.get("eval_count"),
                    )
                return ChatAdapterResponse(
                    reply=reply,
                    provider=self.profile.provider,
                    transport=self.profile.transport,
                    model=self.profile.model,
                    latency_ms=round(total_ms, 2),
                    raw=data,
                )
            except httpx.TimeoutException as exc:
                if attempt < self.max_retries:
                    continue
                raise ChatAdapterError(
                    "LLM service timed out after retries.",
                    error_class="timeout",
                    status_code=504,
                    retryable=True,
                ) from exc
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code == 500 and attempt < self.max_retries:
                    continue
                raise ChatAdapterError(
                    f"LLM service error: {exc}",
                    error_class=_classify_http_status(exc.response.status_code),
                    status_code=503,
                    retryable=exc.response.status_code in {408, 429, 500, 502, 503, 504},
                ) from exc
            except ChatAdapterError:
                raise
            except Exception as exc:
                raise ChatAdapterError(
                    f"LLM service unavailable: {exc}",
                    error_class="provider_unavailable",
                    status_code=503,
                    retryable=True,
                ) from exc

        raise ChatAdapterError(
            "LLM service unavailable: all retries exhausted",
            error_class="provider_unavailable",
            status_code=503,
            retryable=True,
        )

    async def stream(self, request: ChatAdapterRequest) -> AsyncGenerator[ChatStreamEvent, None]:
        started = time.perf_counter()
        messages = [{"role": "system", "content": request.system_prompt}]
        messages.extend(request.history[-10:])
        messages.append({"role": "user", "content": request.message})
        num_predict = request.max_output_tokens or self.default_num_predict
        base_url = self.profile.base_url or ""
        full_content = ""
        first_token_ms: float | None = None
        final_data: dict[str, Any] | None = None

        try:
            async with self.client.stream(
                "POST",
                f"{base_url}/api/chat",
                json={
                    "model": self.profile.model,
                    "messages": messages,
                    "stream": True,
                    "think": False,
                    "keep_alive": self.keep_alive_seconds,
                    "options": {
                        "temperature": request.temperature,
                        "num_predict": num_predict,
                    },
                },
                timeout=self.timeout_seconds,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        data = cast(dict[str, Any], json.loads(line))
                    except json.JSONDecodeError:
                        continue
                    if data.get("done"):
                        final_data = data
                        break
                    token = str(data.get("message", {}).get("content", ""))
                    if not token:
                        continue
                    full_content += token
                    if first_token_ms is None:
                        first_token_ms = (time.perf_counter() - started) * 1000
                    yield ChatStreamEvent(kind="token", token=token)
        except httpx.TimeoutException as exc:
            raise ChatAdapterError(
                "LLM service timed out.",
                error_class="timeout",
                status_code=504,
                retryable=True,
            ) from exc
        except httpx.HTTPStatusError as exc:
            raise ChatAdapterError(
                f"LLM service error: {exc}",
                error_class=_classify_http_status(exc.response.status_code),
                status_code=503,
                retryable=exc.response.status_code in {408, 429, 500, 502, 503, 504},
            ) from exc
        except ChatAdapterError:
            raise
        except Exception as exc:
            raise ChatAdapterError(
                f"LLM service unavailable: {exc}",
                error_class="provider_unavailable",
                status_code=503,
                retryable=True,
            ) from exc

        yield ChatStreamEvent(
            kind="complete",
            payload={
                "full_content": full_content,
                "first_token_ms": first_token_ms,
                "final_data": final_data,
                "model": self.profile.model,
                "num_predict": num_predict,
                "latency_ms": round((time.perf_counter() - started) * 1000, 2),
            },
        )


class AnthropicMessagesAdapter:
    """Anthropic Messages adapter around the existing Claude client wrapper."""

    def __init__(self, *, profile: ProviderProfile, client: ClaudeClient) -> None:
        self.profile = profile
        self.client = client

    async def chat(self, request: ChatAdapterRequest) -> ChatAdapterResponse:
        started = time.perf_counter()
        try:
            response = self.client.chat(
                system_prompt=request.system_prompt,
                message=request.message,
                history=request.history,  # type: ignore[arg-type]
            )
        except Exception as exc:
            error_class = classify_provider_error(exc)
            raise ChatAdapterError(
                str(exc) or error_class,
                error_class=error_class,
                status_code=503,
                retryable=error_class in {"provider_rate_limited", "timeout", "provider_unavailable"},
            ) from exc
        latency_ms = response.latency_ms or round((time.perf_counter() - started) * 1000, 2)
        return ChatAdapterResponse(
            reply=response.reply,
            provider=self.profile.provider,
            transport=self.profile.transport,
            model=response.model,
            tokens_in=response.tokens_in,
            tokens_out=response.tokens_out,
            cost_usd=response.cost_usd,
            latency_ms=latency_ms,
            request_hash=response.request_hash,
        )

    async def stream(self, request: ChatAdapterRequest) -> AsyncGenerator[ChatStreamEvent, None]:
        import asyncio
        import queue

        import anthropic

        token_queue: queue.Queue[tuple[str, object] | None] = queue.Queue()
        history = request.history[-10:]

        def _run_sync_stream() -> None:
            final_model = self.client.model
            full_content = ""
            usage_in = 0
            usage_out = 0
            try:
                client = anthropic.Anthropic(api_key=self.client.api_key)
                with client.messages.stream(
                    model=self.client.model,
                    max_tokens=request.max_output_tokens or self.client.max_tokens,
                    system=request.system_prompt,
                    messages=cast(Any, [*history, {"role": "user", "content": request.message}]),
                ) as stream:
                    for text in stream.text_stream:
                        if not text:
                            continue
                        full_content += text
                        token_queue.put(("token", text))

                    try:
                        final_message = stream.get_final_message()
                        final_model = str(getattr(final_message, "model", final_model))
                        usage = getattr(final_message, "usage", None)
                        usage_in = int(getattr(usage, "input_tokens", 0) or 0)
                        usage_out = int(getattr(usage, "output_tokens", 0) or 0)
                    except Exception:
                        token_queue.put(("metadata_error", "final_message_unavailable"))
            except Exception as exc:
                token_queue.put(("error", exc))
                return
            finally:
                token_queue.put(
                    (
                        "complete",
                        {
                            "full_content": full_content,
                            "model": final_model,
                            "tokens_in": usage_in,
                            "tokens_out": usage_out,
                            "cost_usd": self.client.estimate_cost(
                                tokens_in=usage_in,
                                tokens_out=usage_out,
                                model=final_model,
                            ) if usage_in > 0 or usage_out > 0 else 0.0,
                        },
                    )
                )
                token_queue.put(None)

        loop = asyncio.get_event_loop()
        loop.run_in_executor(None, _run_sync_stream)

        while True:
            try:
                item = token_queue.get_nowait()
            except queue.Empty:
                await asyncio.sleep(0.05)
                continue

            if item is None:
                break

            kind, payload = item
            if kind == "token":
                yield ChatStreamEvent(kind="token", token=str(payload))
                continue
            if kind == "error":
                exc = cast(Exception, payload)
                yield ChatStreamEvent(
                    kind="error",
                    payload={
                        "message": str(exc),
                        "error_class": classify_provider_error(exc),
                    },
                )
                continue
            if kind == "complete":
                yield ChatStreamEvent(kind="complete", payload=cast(dict[str, Any], payload))


class OpenAIResponsesAdapter:
    """OpenAI Responses API adapter for first-party OpenAI API profiles."""

    def __init__(
        self,
        *,
        profile: ProviderProfile,
        api_key: str,
        base_url: str | None = None,
        timeout_seconds: int = 60,
        max_output_tokens: int = 4096,
    ) -> None:
        if not api_key:
            raise ValueError("OpenAI API key must not be empty")
        from openai import OpenAI

        kwargs: dict[str, Any] = {"api_key": api_key}
        if base_url:
            kwargs["base_url"] = base_url
        self.client = OpenAI(**kwargs)
        self.profile = profile
        self.timeout_seconds = timeout_seconds
        self.max_output_tokens = max_output_tokens

    async def chat(self, request: ChatAdapterRequest) -> ChatAdapterResponse:
        started = time.perf_counter()
        request_hash = _compute_request_hash(request.system_prompt, request.history, request.message)
        try:
            response = self.client.responses.create(
                model=self.profile.model,
                instructions=request.system_prompt,
                input=cast(Any, _responses_input(request)),
                max_output_tokens=request.max_output_tokens or self.max_output_tokens,
                temperature=request.temperature,
                timeout=self.timeout_seconds,
            )
        except Exception as exc:
            raise _adapter_error_from_exception(exc) from exc

        usage = getattr(response, "usage", None)
        tokens_in = int(getattr(usage, "input_tokens", 0) or 0)
        tokens_out = int(getattr(usage, "output_tokens", 0) or 0)
        return ChatAdapterResponse(
            reply=str(getattr(response, "output_text", "") or _extract_response_text(response)),
            provider=self.profile.provider,
            transport=self.profile.transport,
            model=str(getattr(response, "model", self.profile.model)),
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            cost_usd=0.0,
            latency_ms=round((time.perf_counter() - started) * 1000, 2),
            request_hash=request_hash,
        )

    async def stream(self, request: ChatAdapterRequest) -> AsyncGenerator[ChatStreamEvent, None]:
        request_hash = _compute_request_hash(request.system_prompt, request.history, request.message)
        full_content = ""
        final_model = self.profile.model
        tokens_in = 0
        tokens_out = 0
        try:
            stream = self.client.responses.create(
                model=self.profile.model,
                instructions=request.system_prompt,
                input=cast(Any, _responses_input(request)),
                max_output_tokens=request.max_output_tokens or self.max_output_tokens,
                temperature=request.temperature,
                stream=True,
                timeout=self.timeout_seconds,
            )
            for event in stream:
                event_type = str(getattr(event, "type", ""))
                if event_type == "response.output_text.delta":
                    token = str(getattr(event, "delta", "") or "")
                    if token:
                        full_content += token
                        yield ChatStreamEvent(kind="token", token=token)
                    continue
                if event_type == "response.completed":
                    response = getattr(event, "response", None)
                    if response is not None:
                        final_model = str(getattr(response, "model", final_model))
                        usage = getattr(response, "usage", None)
                        tokens_in = int(getattr(usage, "input_tokens", 0) or 0)
                        tokens_out = int(getattr(usage, "output_tokens", 0) or 0)
                    continue
        except Exception as exc:
            error = _adapter_error_from_exception(exc)
            raise error from exc

        yield ChatStreamEvent(
            kind="complete",
            payload={
                "full_content": full_content,
                "model": final_model,
                "tokens_in": tokens_in,
                "tokens_out": tokens_out,
                "cost_usd": 0.0,
                "request_hash": request_hash,
            },
        )


class OpenAICompatibleChatAdapter:
    """Adapter for providers exposing OpenAI-compatible chat completions."""

    def __init__(
        self,
        *,
        profile: ProviderProfile,
        api_key: str,
        base_url: str,
        timeout_seconds: int = 60,
        max_output_tokens: int = 4096,
    ) -> None:
        if not api_key:
            raise ValueError("OpenAI-compatible API key must not be empty")
        if not base_url:
            raise ValueError("OpenAI-compatible base URL must not be empty")
        from openai import OpenAI

        self.client = OpenAI(api_key=api_key, base_url=base_url)
        self.profile = profile
        self.timeout_seconds = timeout_seconds
        self.max_output_tokens = max_output_tokens

    async def chat(self, request: ChatAdapterRequest) -> ChatAdapterResponse:
        started = time.perf_counter()
        request_hash = _compute_request_hash(request.system_prompt, request.history, request.message)
        try:
            response = self.client.chat.completions.create(
                model=self.profile.model,
                messages=cast(Any, _chat_completion_messages(request)),
                max_completion_tokens=request.max_output_tokens or self.max_output_tokens,
                temperature=request.temperature,
                timeout=self.timeout_seconds,
            )
        except Exception as exc:
            raise _adapter_error_from_exception(exc) from exc

        choice = response.choices[0] if getattr(response, "choices", None) else None
        message = getattr(choice, "message", None)
        usage = getattr(response, "usage", None)
        return ChatAdapterResponse(
            reply=str(getattr(message, "content", "") or ""),
            provider=self.profile.provider,
            transport=self.profile.transport,
            model=str(getattr(response, "model", self.profile.model)),
            tokens_in=int(getattr(usage, "prompt_tokens", 0) or 0),
            tokens_out=int(getattr(usage, "completion_tokens", 0) or 0),
            cost_usd=0.0,
            latency_ms=round((time.perf_counter() - started) * 1000, 2),
            request_hash=request_hash,
        )

    async def stream(self, request: ChatAdapterRequest) -> AsyncGenerator[ChatStreamEvent, None]:
        request_hash = _compute_request_hash(request.system_prompt, request.history, request.message)
        full_content = ""
        final_model = self.profile.model
        tokens_in = 0
        tokens_out = 0
        try:
            stream = self.client.chat.completions.create(
                model=self.profile.model,
                messages=cast(Any, _chat_completion_messages(request)),
                max_completion_tokens=request.max_output_tokens or self.max_output_tokens,
                temperature=request.temperature,
                stream=True,
                stream_options={"include_usage": True},
                timeout=self.timeout_seconds,
            )
            for chunk in stream:
                final_model = str(getattr(chunk, "model", final_model))
                usage = getattr(chunk, "usage", None)
                if usage is not None:
                    tokens_in = int(getattr(usage, "prompt_tokens", 0) or 0)
                    tokens_out = int(getattr(usage, "completion_tokens", 0) or 0)
                for choice in getattr(chunk, "choices", []) or []:
                    delta = getattr(choice, "delta", None)
                    token = str(getattr(delta, "content", "") or "")
                    if token:
                        full_content += token
                        yield ChatStreamEvent(kind="token", token=token)
        except Exception as exc:
            raise _adapter_error_from_exception(exc) from exc

        yield ChatStreamEvent(
            kind="complete",
            payload={
                "full_content": full_content,
                "model": final_model,
                "tokens_in": tokens_in,
                "tokens_out": tokens_out,
                "cost_usd": 0.0,
                "request_hash": request_hash,
            },
        )


def _responses_input(request: ChatAdapterRequest) -> list[dict[str, str]]:
    turns = [
        {"role": turn["role"], "content": turn["content"]}
        for turn in request.history[-10:]
        if turn.get("role") in {"user", "assistant"} and turn.get("content")
    ]
    turns.append({"role": "user", "content": request.message})
    return turns


def _chat_completion_messages(request: ChatAdapterRequest) -> list[dict[str, str]]:
    messages = [{"role": "system", "content": request.system_prompt}]
    messages.extend(_responses_input(request))
    return messages


def _extract_response_text(response: Any) -> str:
    parts: list[str] = []
    for item in getattr(response, "output", []) or []:
        for content in getattr(item, "content", []) or []:
            text = getattr(content, "text", "")
            if text:
                parts.append(str(text))
    return "".join(parts)


def _compute_request_hash(system_prompt: str, history: list[dict[str, str]], message: str) -> str:
    hasher = hashlib.sha256()
    hasher.update(system_prompt.encode())
    for turn in history[-10:]:
        hasher.update(str(turn.get("role", "")).encode())
        hasher.update(str(turn.get("content", "")).encode())
    hasher.update(b"user")
    hasher.update(message.encode())
    return hasher.hexdigest()


def _adapter_error_from_exception(exc: Exception) -> ChatAdapterError:
    status_code = int(getattr(exc, "status_code", 0) or 0)
    error_class = _classify_http_status(status_code) if status_code else classify_provider_error(exc)
    return ChatAdapterError(
        str(exc) or error_class,
        error_class=error_class,
        status_code=503 if status_code != 504 else 504,
        retryable=error_class in {"provider_rate_limited", "timeout", "provider_unavailable"},
    )


def _classify_http_status(status_code: int) -> str:
    if status_code in {401, 403}:
        return "invalid_key"
    if status_code == 429:
        return "provider_rate_limited"
    if status_code in {402, 409}:
        return "provider_quota_exhausted"
    if status_code in {408, 504}:
        return "timeout"
    if status_code >= 500:
        return "provider_unavailable"
    return "provider_error"


def classify_provider_error(exc: Exception) -> str:
    text = f"{exc.__class__.__name__} {exc}".lower()
    if "safety" in text or "refusal" in text or "content policy" in text:
        return "provider_safety_refusal"
    if "rate" in text and "limit" in text:
        return "provider_rate_limited"
    if "quota" in text or "credit" in text or "billing" in text or "insufficient" in text:
        return "provider_quota_exhausted"
    if "auth" in text or "api key" in text or "permission" in text or "forbidden" in text:
        return "invalid_key"
    if "timeout" in text or "timed out" in text:
        return "timeout"
    if "model" in text and ("not found" in text or "unavailable" in text):
        return "model_unavailable"
    return "provider_error"
