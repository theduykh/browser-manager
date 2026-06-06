import { useState } from 'react';

interface Props {
  value: string[];
  disabled?: boolean;
  suggestions?: string[];
  onChange: (tags: string[]) => void;
}

// Mirror the backend rules (profiles.service.ts) so invalid tags never reach a save.
const TAG_RE = /^[\p{L}\p{N}._-]{1,32}$/u;
const MAX_TAGS = 20;
const MAX_SUGGESTIONS = 8;

export function TagInput({ value, disabled, suggestions = [], onChange }: Props) {
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  // Suggest existing tags as the user types: substring match, minus already-chosen ones.
  const query = draft.trim().toLowerCase();
  const matches = suggestions
    .filter((s) => !value.includes(s))
    .filter((s) => query === '' || s.toLowerCase().includes(query))
    .slice(0, MAX_SUGGESTIONS);

  const showDropdown = open && !disabled && matches.length > 0;

  const addTag = (tag: string) => {
    if (value.includes(tag) || value.length >= MAX_TAGS) return;
    onChange([...value, tag]);
  };

  // Free-typed token: validate against the same rules as the backend. Returns true when the
  // draft was handled (added / empty / duplicate) so the caller can clear it.
  const commitDraft = (raw: string): boolean => {
    const token = raw.trim();
    if (token === '') return true;
    if (value.includes(token)) return true;
    if (!TAG_RE.test(token) || value.length >= MAX_TAGS) return false;
    onChange([...value, token]);
    return true;
  };

  const pick = (tag: string) => {
    addTag(tag);
    setDraft('');
    setHighlight(-1);
    setOpen(false);
  };

  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, -1));
    } else if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (showDropdown && highlight >= 0 && highlight < matches.length) {
        pick(matches[highlight]);
      } else if (commitDraft(draft)) {
        setDraft('');
        setHighlight(-1);
      }
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      remove(value[value.length - 1]);
    }
  };

  // Bold the matched characters so the per-keystroke match is visible.
  const renderLabel = (s: string) => {
    if (query === '') return s;
    const idx = s.toLowerCase().indexOf(query);
    if (idx === -1) return s;
    return (
      <>
        {s.slice(0, idx)}
        <strong>{s.slice(idx, idx + query.length)}</strong>
        {s.slice(idx + query.length)}
      </>
    );
  };

  return (
    <div className="tag-input-wrap">
      <div className={`tag-input ${disabled ? 'is-disabled' : ''}`}>
        {value.map((tag) => (
          <span key={tag} className="tag-chip">
            {tag}
            {!disabled && (
              <button
                type="button"
                className="tag-chip-remove"
                aria-label={`Remove ${tag}`}
                onClick={() => remove(tag)}
              >
                ×
              </button>
            )}
          </span>
        ))}
        <input
          type="text"
          value={draft}
          disabled={disabled}
          placeholder={value.length === 0 ? 'Add a tag…' : ''}
          onChange={(e) => { setDraft(e.target.value); setOpen(true); setHighlight(-1); }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => { if (commitDraft(draft)) setDraft(''); setOpen(false); setHighlight(-1); }}
        />
      </div>
      {showDropdown && (
        <ul className="tag-suggest" role="listbox">
          {matches.map((s, i) => (
            <li
              key={s}
              role="option"
              aria-selected={i === highlight}
              className={`tag-suggest-item ${i === highlight ? 'is-active' : ''}`}
              onMouseEnter={() => setHighlight(i)}
              // mousedown (not click) so it fires before the input's blur and keeps focus.
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
            >
              {renderLabel(s)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
