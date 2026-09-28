const translateControlCss = `
:host {
  all: initial;
  color: #d7dde8;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 12px;
  line-height: 1.2;
}

.control {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

button {
  appearance: none;
  border: 1px solid #4e5d75;
  border-radius: 6px;
  background: #202a3a;
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  min-height: 28px;
  padding: 4px 8px;
}

button:hover:not(:disabled) {
  background: #2a3850;
}

button:focus-visible {
  outline: 2px solid #7db3ff;
  outline-offset: 2px;
}

button:disabled {
  cursor: progress;
  opacity: 0.7;
}

[role="alert"] {
  color: #ffb4ab;
  max-width: 240px;
}
`;

export default translateControlCss;
