import MessengerChat from "@/components/dashboard/SalesDashboard/MessengerChat"
import { getConversations } from "@/lib/messenger/messenger-data"

export default async function SalesMessengerPage() {
  const { conversations } = await getConversations()
  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col">
      <MessengerChat initialConversations={conversations} />
    </div>
  )
}
