import { Inbox as InboxIcon } from "lucide-react";
import { ConversationList } from "./_components/ConversationList";

export default function ConversationsIndex() {
  return (
    <div className="grid grid-cols-[340px_1fr] h-dvh">
      <ConversationList />
      <section className="grid place-items-center text-center px-8">
        <div className="max-w-sm space-y-3">
          <div className="mx-auto size-14 grid place-items-center rounded-2xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
            <InboxIcon className="size-7" />
          </div>
          <h2 className="text-lg font-medium">Pick a conversation</h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Incoming messages from all your ManyChat pages land here in real time. Open one to reply
            or accept the Claude-suggested reply.
          </p>
        </div>
      </section>
    </div>
  );
}
