import { NextURL } from "next/dist/server/web/next-url";
import {NextRequest, NextResponse} from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN!;

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
    const mode = req.nextUrl.searchParams.get("hub.mode");
    const token = req.nextUrl.searchParams.get("hub.verify_token");
    const challenge = req.nextUrl.searchParams.get("hub.challenge");

    if(
        mode === "subscribe" &&
        token === VERIFY_TOKEN
    ){
        return new Response(challenge, {status: 200});
    }

    return new Response("Forbidden", {status: 403});
}

export async function POST(req:NextRequest) {
    const body = await req.json();

    const entry = body.entry?.[0];
    const messaging = entry.messaging?.[0];

    if(!messaging){
        return NextResponse.json({received: true});
    }

    const senderId = messaging.sender?.id;
    const timestamp = new Date(messaging.timestamp).toISOString();
    const messageText = messaging.message?.text;

    const profileRes = await fetch(
        `https://graph.facebook.com/${senderId}?fields=name,profile_pic&access_token=${process.env.META_PAGE_ACCESS_TOKEN}`
    )

    const profile = await profileRes.json();
    console.log("Profile API Response:", JSON.stringify(profile, null, 2))

    console.log("New Message Received");
    console.log("From (Sender ID): ", senderId);
    console.log("Name: ", profile.name);
    console.log("Profile Pic: ", profile.profile_pic);
    console.log("Timestamp: ", timestamp);
    console.log("Message: ", messageText);

    const admin = getAdmin();

    await admin.from("inquiry").insert({
        messenger_name: profile.name,
        psid: senderId,
        inquiry_type: "Booking", //hardcoded for now
        status: "unresolved",   //hardvoded for now
        escalated_at: timestamp,
    })
    
    return NextResponse.json({received: true});
}