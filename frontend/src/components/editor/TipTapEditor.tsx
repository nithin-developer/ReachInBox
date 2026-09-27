import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import {
  IconBold,
  IconItalic,
  IconUnderline,
  IconStrikethrough,
  IconH1,
  IconH2,
  IconList,
  IconListNumbers,
  IconQuote,
  IconCode,
  IconLink,
  IconRotate2,
  IconRotateClockwise2,
} from '@tabler/icons-react';

export interface TipTapEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({
  content,
  onChange,
  placeholder = 'Write your cold email body here...',
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-emerald-600 underline font-medium cursor-pointer',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'min-h-[220px] max-h-[380px] overflow-y-auto px-4 py-3.5 focus:outline-none prose dark:prose-invert max-w-none text-sm text-foreground leading-relaxed',
      },
    },
  });

  if (!editor) {
    return null;
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) {
      return;
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="rounded-xl border border-border/80 bg-card overflow-hidden transition-all focus-within:border-ring/60">
      {/* TipTap Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border/80 bg-muted/30 px-3 py-1.5 text-muted-foreground select-none">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground transition-colors ${
            editor.isActive('bold') ? 'bg-muted text-foreground font-bold' : ''
          }`}
          title="Bold (Ctrl+B)"
        >
          <IconBold className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground transition-colors ${
            editor.isActive('italic') ? 'bg-muted text-foreground' : ''
          }`}
          title="Italic (Ctrl+I)"
        >
          <IconItalic className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground transition-colors ${
            editor.isActive('underline') ? 'bg-muted text-foreground' : ''
          }`}
          title="Underline (Ctrl+U)"
        >
          <IconUnderline className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground transition-colors ${
            editor.isActive('strike') ? 'bg-muted text-foreground' : ''
          }`}
          title="Strikethrough"
        >
          <IconStrikethrough className="h-4 w-4" />
        </button>

        <div className="h-4 w-[1px] bg-border mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground transition-colors ${
            editor.isActive('heading', { level: 1 }) ? 'bg-muted text-foreground' : ''
          }`}
          title="Heading 1"
        >
          <IconH1 className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground transition-colors ${
            editor.isActive('heading', { level: 2 }) ? 'bg-muted text-foreground' : ''
          }`}
          title="Heading 2"
        >
          <IconH2 className="h-4 w-4" />
        </button>

        <div className="h-4 w-[1px] bg-border mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground transition-colors ${
            editor.isActive('bulletList') ? 'bg-muted text-foreground' : ''
          }`}
          title="Bullet List"
        >
          <IconList className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground transition-colors ${
            editor.isActive('orderedList') ? 'bg-muted text-foreground' : ''
          }`}
          title="Numbered List"
        >
          <IconListNumbers className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground transition-colors ${
            editor.isActive('blockquote') ? 'bg-muted text-foreground' : ''
          }`}
          title="Quote"
        >
          <IconQuote className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground transition-colors ${
            editor.isActive('codeBlock') ? 'bg-muted text-foreground' : ''
          }`}
          title="Code Block"
        >
          <IconCode className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={setLink}
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground transition-colors ${
            editor.isActive('link') ? 'bg-muted text-emerald-600' : ''
          }`}
          title="Insert Link"
        >
          <IconLink className="h-4 w-4" />
        </button>

        <div className="h-4 w-[1px] bg-border mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-1.5 rounded hover:bg-muted hover:text-foreground disabled:opacity-40 transition-colors"
          title="Undo (Ctrl+Z)"
        >
          <IconRotate2 className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-1.5 rounded hover:bg-muted hover:text-foreground disabled:opacity-40 transition-colors"
          title="Redo (Ctrl+Y)"
        >
          <IconRotateClockwise2 className="h-4 w-4" />
        </button>
      </div>

      {/* Editor Surface */}
      <EditorContent editor={editor} />
    </div>
  );
};
