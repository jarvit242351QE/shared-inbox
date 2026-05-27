import { ConversationList } from "../_components/ConversationList";
import { Thread } from "../_components/Thread";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="grid grid-cols-[340px_1fr] h-dvh">
      <ConversationList activeId={id} />
      <Thread conversationId={id} />
    </div>
  );
}
