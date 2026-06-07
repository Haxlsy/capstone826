import { NextURL } from "next/dist/server/web/next-url";
import {NextRequest, NextResponse} from "next/server";

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN!;

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

    console.log("New Message Received");
    console.log("From (Sender ID): ", senderId);
    console.log("Timestamp: ", timestamp);
    console.log("Message: ", messageText);
    
    return NextResponse.json({received: true});
}