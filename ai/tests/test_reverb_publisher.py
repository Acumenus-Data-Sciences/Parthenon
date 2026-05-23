from unittest.mock import MagicMock

from app.agents.reverb_publisher import ReverbPublisher, channel_for_session


def test_channel_name_is_private_prefixed():
    assert channel_for_session(42) == "private-study-design.session.42"


def test_publish_triggers_pusher_with_private_channel():
    fake_client = MagicMock()
    pub = ReverbPublisher(client=fake_client)

    pub.publish(session_id=42, event="agent.text.delta", data={"text": "hi"})

    fake_client.trigger.assert_called_once_with(
        "private-study-design.session.42",
        "agent.text.delta",
        {"text": "hi"},
    )


def test_publish_swallows_errors_fail_open():
    fake_client = MagicMock()
    fake_client.trigger.side_effect = RuntimeError("reverb down")
    pub = ReverbPublisher(client=fake_client)

    # Must not raise — streaming is best-effort; Laravel snapshot is authoritative.
    pub.publish(session_id=1, event="agent.error", data={"message": "x"})
