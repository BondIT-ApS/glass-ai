import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce } from './debounce';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not invoke the function immediately', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);
    debounced();
    expect(fn).not.toHaveBeenCalled();
  });

  it('invokes the function after the wait period', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);
    debounced();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('does not invoke before the wait period expires', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);
    debounced();
    vi.advanceTimersByTime(199);
    expect(fn).not.toHaveBeenCalled();
  });

  it('coalesces multiple rapid calls into a single invocation', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);
    debounced();
    debounced();
    debounced();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('uses the arguments from the last call', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);
    debounced('first');
    debounced('second');
    debounced('third');
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledWith('third');
  });

  it('resets the timer when called again before wait expires', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced();
    vi.advanceTimersByTime(150); // not yet fired
    debounced();                  // reset
    vi.advanceTimersByTime(150); // only 150 ms since reset — should not fire
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50); // now 200 ms since reset
    expect(fn).toHaveBeenCalledOnce();
  });

  it('allows a second independent call after the first has fired', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced('a');
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith('a');

    debounced('b');
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('b');
  });

  it('forwards multiple arguments correctly', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced(1, 2, 3);
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith(1, 2, 3);
  });
});
