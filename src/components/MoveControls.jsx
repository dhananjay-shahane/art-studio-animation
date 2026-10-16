import React, { useRef, useCallback } from 'react';

const ArrowUp    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>;
const ArrowDown  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>;
const ArrowLeft  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;
const ArrowRight = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
const ResetIcon  = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>;

function DpadBtn({ code, isReset = false, children, pressKey, releaseKey, resetPosition }) {
  const pressedRef = useRef(false);
  const elRef      = useRef(null);

  const press = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (pressedRef.current) return;
    pressedRef.current = true;
    elRef.current?.setAttribute('data-active', 'true');
    if (!isReset) pressKey(code);
  }, [code, isReset, pressKey]);

  const release = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!pressedRef.current && !isReset) return;
    pressedRef.current = false;
    elRef.current?.setAttribute('data-active', 'false');
    if (isReset) resetPosition();
    else releaseKey(code);
  }, [code, isReset, releaseKey, resetPosition]);

  const cancel = useCallback(() => {
    if (!pressedRef.current) return;
    pressedRef.current = false;
    elRef.current?.setAttribute('data-active', 'false');
    if (!isReset) releaseKey(code);
  }, [code, isReset, releaseKey]);

  /* Direction button */
  if (!isReset) return (
    <button
      ref={elRef}
      type="button"
      data-active="false"
      className="dpad-btn w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center
        bg-white/92 backdrop-blur-sm border border-[#c8e0c8] text-[#2d5038]
        shadow-[0_2px_6px_rgba(45,80,56,0.14)]
        transition-all duration-100 cursor-pointer select-none touch-manipulation
        hover:bg-[#e8f5e9] hover:border-[#6da27c] hover:shadow-md"
      onPointerDown={press}
      onPointerUp={release}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      aria-label={code}
    >
      {children}
    </button>
  );

  /* Reset button */
  return (
    <button
      ref={elRef}
      type="button"
      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center
        bg-white/88 backdrop-blur-sm border border-[#e2e8f0] text-[#94a3b8]
        shadow-[0_2px_4px_rgba(45,80,56,0.10)]
        transition-all duration-100 cursor-pointer select-none touch-manipulation
        hover:bg-[#fff5f5] hover:border-[#fca5a5] hover:text-[#ef4444]
        active:bg-[#ef4444] active:text-white active:scale-90"
      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onPointerUp={release}
      aria-label="reset"
    >
      {children}
    </button>
  );
}

export default function MoveControls({ pressKey, releaseKey, resetPosition, authVisible = false }) {
  return (
    /* ── Bottom-RIGHT of the 3D viewport ── */
    <div
      style={{
        position: 'absolute',
        bottom: '14px',
        right: '14px',
        zIndex: 40,
      }}
      className={`dpad-container flex flex-col items-center gap-1 select-none transition-all duration-300 origin-bottom-right scale-90 sm:scale-100 ${authVisible ? 'dpad-mobile-hidden' : ''}`}
    >
      {/* Up */}
      <div className="flex justify-center">
        <DpadBtn code="ArrowUp" pressKey={pressKey} releaseKey={releaseKey} resetPosition={resetPosition}>
          <ArrowUp />
        </DpadBtn>
      </div>

      {/* Left · Reset · Right */}
      <div className="flex items-center gap-1">
        <DpadBtn code="ArrowLeft" pressKey={pressKey} releaseKey={releaseKey} resetPosition={resetPosition}>
          <ArrowLeft />
        </DpadBtn>
        <DpadBtn code="reset" isReset pressKey={pressKey} releaseKey={releaseKey} resetPosition={resetPosition}>
          <ResetIcon />
        </DpadBtn>
        <DpadBtn code="ArrowRight" pressKey={pressKey} releaseKey={releaseKey} resetPosition={resetPosition}>
          <ArrowRight />
        </DpadBtn>
      </div>

      {/* Down */}
      <div className="flex justify-center">
        <DpadBtn code="ArrowDown" pressKey={pressKey} releaseKey={releaseKey} resetPosition={resetPosition}>
          <ArrowDown />
        </DpadBtn>
      </div>
    </div>
  );
}
