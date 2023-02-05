import { describe, expect, it, vi } from "vitest";
import { Server } from "../../models/servers";
import { parseServer } from "../helpers";

describe("helper tests", () => {
  it("test parse server", () => {
    const tests = [
      [{}, undefined],
      [undefined, undefined],
      [
        {
          default: 0,
          encoding: "utf8",
          flags: 19,
          network: "test",
          servers: [],
        },
        undefined,
      ],
      [
        {
          default: 0,
          encoding: "utf8",
          flags: 19,
          network: "test",
          servers: ["irc.example.com"],
        },
        { host: "irc.example.com", port: 6667 },
      ],
      [
        {
          default: 0,
          encoding: "utf8",
          flags: 19,
          network: "test",
          servers: ["irc1.example.com", "irc1.example.com"],
        },
        { host: "irc1.example.com", port: 6667 },
      ],
      [
        {
          default: 0,
          encoding: "utf8",
          flags: 19,
          network: "test",
          servers: ["irc1.example.com:1234", "irc1.example.com:567"],
        },
        { host: "irc1.example.com", port: 1234 },
      ],
      [
        {
          default: 0,
          encoding: "utf8",
          flags: 19,
          network: "test",
          servers: ["irc1.example.com:", "irc1.example.com:"],
        },
        { host: "irc1.example.com", port: 6667 },
      ],
    ];
    for (const test of tests) {
      const server = test?.[0];
      const result = test?.[1];

      expect(parseServer(server as Server)).toStrictEqual(result);
    }
  });
});
