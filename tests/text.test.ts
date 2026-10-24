import { describe, it, expect } from "vitest"
import {
  cleanValueAndCaret, emojiError, stageNamesEmojiError, stripEmoji,
  stripInvisible, stripInvisibleDeep, stripInvisibleGeneric,
} from "@/lib/text"
import { readJsonBody } from "@/lib/http/read-json-body"

describe("invisible characters in free-text fields", () => {
  it("are stripped as typed, along with emoji", () => {
    expect(stripEmoji("Premium Washㅤ")).toBe("Premium Wash")
    expect(stripEmoji("ㅤ😀")).toBe("")
    expect(stripInvisible("Stage​ 2")).toBe("Stage 2")
  })

  it("are rejected on the server with their own message", () => {
    expect(emojiError("ㅤㅤ", "Service name")).toBe("Service name can't contain invisible characters.")
    expect(emojiError("Wash 😀", "Service name")).toBe("Service name can't contain emoji.")
    expect(emojiError("9H Ceramic", "Service name")).toBeNull()
  })

  it("are caught in stage names", () => {
    expect(stageNamesEmojiError([{ name: "Stage 1" }, { name: "ㅤ" }])).toMatch(/invisible/)
    expect(stageNamesEmojiError([{ name: "Stage 1" }])).toBeNull()
  })
})


describe("generic invisible-character guard (every field)", () => {
  it("keeps emoji made with zero-width joiners intact", () => {
    expect(stripInvisibleGeneric("Done 👨‍👩‍👧 ㅤ")).toBe("Done 👨‍👩‍👧 ")
  })

  it("cleans every string in a nested body but skips secrets", () => {
    const body = {
      serviceName: "Washㅤ",
      stages: [{ name: "ㅤㅤ" }, { name: "Dry​" }],
      email: "juan﻿@mail.com",
      password: "pㅤss",
      newPassword: "nㅤw",
      code: "12ㅤ3",
      count: 3,
      active: true,
      note: null,
    }
    expect(stripInvisibleDeep(body, { skipKeys: ["password", "newPassword", "code"] })).toEqual({
      serviceName: "Wash",
      stages: [{ name: "" }, { name: "Dry" }],
      email: "juan@mail.com",
      password: "pㅤss",
      newPassword: "nㅤw",
      code: "12ㅤ3",
      count: 3,
      active: true,
      note: null,
    })
  })

  it("moves the caret left by the characters removed before it", () => {
    expect(cleanValueAndCaret("Aㅤㅤ", 3)).toEqual({ value: "A", caret: 1 })
    expect(cleanValueAndCaret("abㅤcd", 5)).toEqual({ value: "abcd", caret: 4 })
    expect(cleanValueAndCaret("abcdㅤ", 2)).toEqual({ value: "abcd", caret: 2 })
    expect(cleanValueAndCaret("clean", 3)).toEqual({ value: "clean", caret: 3 })
  })

  it("readJsonBody cleans the request body before a route sees it", async () => {
    const req = new Request("http://localhost/api/x", {
      method: "POST",
      body: JSON.stringify({ firstName: "Noneㅤ", lastName: "ㅤㅤ", password: "secretㅤ" }),
    })
    expect(await readJsonBody(req)).toEqual({ firstName: "None", lastName: "", password: "secretㅤ" })
  })
})
