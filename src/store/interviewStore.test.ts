import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useInterviewStore } from "@/store/interviewStore";

/**
 * The interview timer is TIMESTAMP-based, not tick-counted, so it survives
 * background-tab throttling and a page refresh. CLAUDE.md forbids reintroducing
 * tick counting; these tests make that concrete by moving the clock rather than
 * running real time.
 */
const s = () => useInterviewStore.getState();

describe("interview timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    s().endInterview();
  });
  afterEach(() => vi.useRealTimers());

  it("reports zero before it starts", () => {
    expect(s().elapsedSeconds()).toBe(0);
  });

  it("derives elapsed time from wall-clock, not from ticks", () => {
    // Nothing increments a counter here: advancing the clock is enough.
    s().startInterview();
    vi.advanceTimersByTime(90_000);
    expect(s().elapsedSeconds()).toBe(90);
  });

  it("keeps counting across a gap with no activity — a throttled tab loses nothing", () => {
    s().startInterview();
    vi.advanceTimersByTime(10 * 60_000);
    expect(s().elapsedSeconds()).toBe(600);
  });

  it("stops accruing while paused", () => {
    s().startInterview();
    vi.advanceTimersByTime(30_000);
    s().toggleTimer();
    vi.advanceTimersByTime(60_000);
    expect(s().elapsedSeconds()).toBe(30);
  });

  it("resumes from where it paused rather than restarting", () => {
    s().startInterview();
    vi.advanceTimersByTime(30_000);
    s().toggleTimer();
    vi.advanceTimersByTime(60_000);
    s().toggleTimer();
    vi.advanceTimersByTime(10_000);
    expect(s().elapsedSeconds()).toBe(40);
  });

  it("resets to zero when the interview ends", () => {
    s().startInterview();
    vi.advanceTimersByTime(45_000);
    s().endInterview();
    expect(s().elapsedSeconds()).toBe(0);
  });

  it("never reports negative elapsed time", () => {
    s().startInterview();
    vi.advanceTimersByTime(5_000);
    expect(s().elapsedSeconds()).toBeGreaterThanOrEqual(0);
  });
});
