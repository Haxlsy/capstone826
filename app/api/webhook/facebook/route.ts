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

    console.log(JSON.stringify(body, null, 2));
    
    return NextResponse.json({received: true});
}