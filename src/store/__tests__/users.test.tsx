/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react-hooks";
import { useUsersStore } from "../users";
import { User } from "../../types";

describe("users tests", () => {
  it("test add user", () => {
    const { result } = renderHook(() => useUsersStore());

    act(() => {
      result.current.setAddUser({
        nick: "test-nick1",
        ident: "",
        hostname: "",
        avatarUrl: "",
        modes: [],
        maxMode: 0,
        channels: [],
      });
    });

    expect(result.current.users.length).toStrictEqual(1);
  });

  it("test quit user", () => {
    const { result } = renderHook(() => useUsersStore());

    act(() => {
      result.current.setAddUser({
        nick: "test-nick1",
        ident: "",
        hostname: "",
        avatarUrl: "",
        modes: [],
        maxMode: 0,
        channels: [],
      });
    });
    act(() => {
      result.current.setQuitUser("test-nick1");
    });

    expect(result.current.users.length).toStrictEqual(0);
  });

  it("test rename user", () => {
    const { result } = renderHook(() => useUsersStore());

    act(() => {
      result.current.setAddUser({
        nick: "test-nick1",
        ident: "",
        hostname: "",
        avatarUrl: "",
        avatarData: "",
        modes: [],
        maxMode: 0,
        channels: [],
      });
    });
    act(() => {
      result.current.setRenameUser("test-nick1", "test-nick2");
    });

    expect(result.current.users.length).toStrictEqual(1);
    expect(result.current.users[0]?.nick).toStrictEqual("test-nick2");
  });

  it("test get user", () => {
    const { result } = renderHook(() => useUsersStore());

    const newUser = {
      nick: "test-nick1",
      ident: "",
      hostname: "",
      avatarUrl: "",
      avatarData: "",
      modes: [],
      maxMode: 0,
      channels: [],
    };

    let testResult: User | undefined = undefined;
    act(() => {
      result.current.setAddUser(newUser);
    });
    act(() => {
      testResult = result.current.getUser("test-nick1");
    });

    expect(testResult).toStrictEqual(newUser);
  });

  it("test has user", () => {
    const { result } = renderHook(() => useUsersStore());

    const newUser = {
      nick: "test-nick1",
      ident: "",
      hostname: "",
      avatarUrl: "",
      avatarData: "",
      modes: [],
      maxMode: 0,
      channels: [],
    };

    let testResult1;
    act(() => {
      result.current.setAddUser(newUser);
    });
    act(() => {
      testResult1 = result.current.getHasUser("test-nick1");
    });

    expect(testResult1).toStrictEqual(true);

    let testResult2;
    act(() => {
      testResult2 = result.current.getHasUser("test-nick3");
    });

    expect(testResult2).toStrictEqual(false);
  });

  it("test get users from channel", () => {
    const { result } = renderHook(() => useUsersStore());

    const newUser1 = {
      nick: "test-nick-1",
      ident: "",
      hostname: "",
      avatarUrl: "",
      avatarData: "",
      modes: [],
      maxMode: 0,
      channels: ["channel1"],
    };
    const newUser2 = {
      nick: "test-nick-2",
      ident: "",
      hostname: "",
      avatarUrl: "",
      avatarData: "",
      modes: [],
      maxMode: 0,
      channels: ["channel2"],
    };
    const newUser3 = {
      nick: "test-nick-3",
      ident: "",
      hostname: "",
      avatarUrl: "",
      avatarData: "",
      modes: [],
      maxMode: 0,
      channels: ["channel1", "channel2"],
    };
    const newUser4 = {
      nick: "test-nick-4",
      ident: "",
      hostname: "",
      avatarUrl: "",
      avatarData: "",
      modes: [],
      maxMode: 0,
      channels: ["channel4"],
    };

    let testResult1;
    act(() => {
      result.current.setAddUser(newUser1);
      result.current.setAddUser(newUser2);
      result.current.setAddUser(newUser3);
      result.current.setAddUser(newUser4);
    });
    act(() => {
      testResult1 = result.current.getUsersFromChannel("channel4");
    });

    expect(testResult1).toStrictEqual([newUser4]);

    let testResult2;
    act(() => {
      testResult2 = result.current.getUsersFromChannel("channel2");
    });

    expect(testResult2).toStrictEqual([newUser2, newUser3]);
  });
});
