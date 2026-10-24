import { describe, it, expect } from "vitest"
import { emojiError, stageNamesEmojiError, stripEmoji, stripInvisible } from "@/lib/text"

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
