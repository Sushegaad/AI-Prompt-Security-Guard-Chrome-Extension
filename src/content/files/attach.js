/* ============================================================================
 * AI Prompt - Security Guard — Attachment watcher
 * ----------------------------------------------------------------------------
 * Detects when a file is being attached to the page, three ways:
 *   - a file <input> firing 'change' (capture phase)
 *   - a drag-and-drop 'drop' carrying files (capture phase)
 *   - a clipboard 'paste' carrying files — the screenshot path (capture phase)
 * Calls onAttach(files[]) so the orchestrator can show the Tier 0 nudge and run
 * the Tier 1 on-device content scan. Detection only; no parsing here.
 * ========================================================================== */

/** True when a file is an image (screenshots, photos) — content this scanner
 *  cannot read, which deserves its own nudge copy. */
export function isImageFile(file) {
  return !!file && typeof file.type === 'string' && file.type.startsWith('image/');
}

export function initAttachWatcher(onAttach, isEnabled, doc = document) {
  const fire = (fileList) => {
    if (!isEnabled || !isEnabled()) return;
    const files = fileList ? Array.from(fileList) : [];
    if (files.length) onAttach(files);
  };

  doc.addEventListener(
    'change',
    (e) => {
      const t = e.target;
      if (t && t.matches && t.matches('input[type="file"]') && t.files) fire(t.files);
    },
    true
  );

  doc.addEventListener(
    'drop',
    (e) => {
      if (e.dataTransfer && e.dataTransfer.files) fire(e.dataTransfer.files);
    },
    true
  );

  // Pasted screenshots: the most common way an image reaches an AI chat.
  // clipboardData.files is populated for image pastes; plain-text pastes have
  // an empty file list, so typing/pasting text never fires this.
  doc.addEventListener(
    'paste',
    (e) => {
      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length) {
        fire(e.clipboardData.files);
      }
    },
    true
  );
}
