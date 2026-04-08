// NOT CONNECTED YET
// This route will serve real notifications from the database once the
// notifications table is set up. For now it returns an empty array.
//
// Planned schema (notifications table):
//   notification_id  serial primary key
//   user_id          uuid references users(user_id)
//   title            text
//   message          text
//   type             text  -- 'info' | 'warning' | 'success'
//   read             boolean default false
//   created_at       timestamptz default now()
//
// When connected:
//   GET  /api/notifications        → fetch notifications for the current user
//   POST /api/notifications/read   → mark one or all as read

import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ notifications: [] })
}
