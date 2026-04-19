import * as React from 'react';
import { cn } from '../../utils/cn';

export interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export function RichTextEditor({
  value = '',
  onChange,
  placeholder = 'Start writing...',
  minHeight = 200,
  disabled = false,
  error,
  className,
}: RichTextEditorProps) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const [focused, setFocused] = React.useState(false);

  const handleInput = () => {
    if (editorRef.current && onChange) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'rounded-lg border overflow-hidden transition-colors duration-200',
          focused ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-gray-700',
          error && 'border-red-500',
          disabled && 'opacity-50'
        )}
      >
        <Toolbar onCommand={execCommand} disabled={disabled} />
        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={handleInput}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={cn(
            'px-4 py-3 text-sm text-white bg-gray-900 outline-none overflow-y-auto',
            'prose prose-invert prose-sm max-w-none',
          )}
          style={{ minHeight }}
          data-placeholder={placeholder}
          dangerouslySetInnerHTML={{ __html: value }}
          role="textbox"
          aria-multiline="true"
          aria-label="Rich text editor"
          aria-placeholder={placeholder}
        />
      </div>
      {error && <p className="text-xs text-red-400 mt-1" role="alert">{error}</p>}
    </div>
  );
}

interface ToolbarProps {
  onCommand: (command: string, value?: string) => void;
  disabled?: boolean;
}

function Toolbar({ onCommand, disabled }: ToolbarProps) {
  const buttons: { command: string; icon: string; label: string; value?: string }[] = [
    { command: 'bold', icon: 'B', label: 'Bold' },
    { command: 'italic', icon: 'I', label: 'Italic' },
    { command: 'underline', icon: 'U', label: 'Underline' },
    { command: 'strikeThrough', icon: 'S', label: 'Strikethrough' },
    { command: 'insertUnorderedList', icon: '•', label: 'Bullet list' },
    { command: 'insertOrderedList', icon: '1.', label: 'Numbered list' },
    { command: 'formatBlock', icon: 'H1', label: 'Heading 1', value: 'h1' },
    { command: 'formatBlock', icon: 'H2', label: 'Heading 2', value: 'h2' },
    { command: 'formatBlock', icon: 'Q', label: 'Quote', value: 'blockquote' },
    { command: 'justifyLeft', icon: '≡', label: 'Align left' },
    { command: 'justifyCenter', icon: '≡', label: 'Align center' },
    { command: 'createLink', icon: '🔗', label: 'Insert link' },
  ];

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 bg-gray-800 border-b border-gray-700 flex-wrap" role="toolbar" aria-label="Text formatting">
      {buttons.map(btn => (
        <button
          key={`${btn.command}-${btn.value || ''}`}
          type="button"
          disabled={disabled}
          onMouseDown={e => {
            e.preventDefault();
            if (btn.command === 'createLink') {
              const url = prompt('Enter URL:');
              if (url) onCommand(btn.command, url);
            } else {
              onCommand(btn.command, btn.value);
            }
          }}
          className="px-2 py-1 text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors disabled:opacity-30"
          aria-label={btn.label}
          title={btn.label}
        >
          {btn.icon}
        </button>
      ))}
    </div>
  );
}
