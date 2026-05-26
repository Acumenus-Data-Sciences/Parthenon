from unittest.mock import MagicMock

from app.agents.reverb_publisher import ReverbPublisher


def test_publish_triggers_pusher_with_given_channel():
    fake_client = MagicMock()
    pub = ReverbPublisher(client=fake_client)

    pub.publish(channel="private-study-design.session.42", event="agent.text.delta", data={"text": "hi"})

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
    pub.publish(channel="private-study-design.session.1", event="agent.error", data={"message": "x"})


def test_publish_accepts_arbitrary_channel_names():
    fake_client = MagicMock()
    pub = ReverbPublisher(client=fake_client)

    pub.publish(channel="private-publish.draft.99", event="agent.turn.done", data={"cost_usd": 0.01})

    fake_client.trigger.assert_called_once_with(
        "private-publish.draft.99",
        "agent.turn.done",
        {"cost_usd": 0.01},
    )
