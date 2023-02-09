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
        avatarData: "",
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
        avatarData: "",
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
});
