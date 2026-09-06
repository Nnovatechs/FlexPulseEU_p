"use client";

type EditorInfoTipProps = {
  label: string;
  tooltip: string;
};

export function EditorInfoTip({ label, tooltip }: EditorInfoTipProps) {
  return (
    <button
      type="button"
      className="editor-info-tip"
      aria-label={label}
      data-tooltip={tooltip}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      i
    </button>
  );
}
