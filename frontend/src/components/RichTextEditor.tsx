import { forwardRef, useImperativeHandle } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Box, Divider, ToggleButton, ToggleButtonGroup } from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export interface RichTextEditorHandle {
  setContent: (html: string) => void;
}

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor(
  { content, onChange, placeholder, minHeight = 260 },
  ref
) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        code: false,
        link: false,
      }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    content: content || '',
    onUpdate: ({ editor }) => {
      onChange(editor.isEmpty ? '' : editor.getHTML());
    },
  });

  useImperativeHandle(ref, () => ({
    setContent: (html: string) => {
      editor?.commands.setContent(html, { emitUpdate: true });
    },
  }), [editor]);

  if (!editor) {
    return null;
  }

  return (
    <Box
      sx={{
        border: '1px solid #dbe3ee',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <ToggleButtonGroup size="small" sx={{ p: 1, gap: 0.5, backgroundColor: '#f8fafc' }}>
        <ToggleButton
          value="bold"
          selected={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <FormatBoldIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton
          value="italic"
          selected={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <FormatItalicIcon fontSize="small" />
        </ToggleButton>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        <ToggleButton
          value="bulletList"
          selected={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <FormatListBulletedIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton
          value="orderedList"
          selected={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <FormatListNumberedIcon fontSize="small" />
        </ToggleButton>
      </ToggleButtonGroup>

      <Divider />

      <Box
        sx={{
          p: 2,
          minHeight,
          maxHeight: 480,
          overflowY: 'auto',
          cursor: 'text',
          '& .ProseMirror': {
            outline: 'none',
            minHeight: minHeight - 32,
          },
          '& .ProseMirror p.is-editor-empty:first-of-type::before': {
            content: 'attr(data-placeholder)',
            color: '#94a3b8',
            float: 'left',
            height: 0,
            pointerEvents: 'none',
          },
          '& ul, & ol': {
            paddingLeft: '1.5rem',
            margin: 0,
          },
          '& p': {
            margin: 0,
          },
        }}
        onClick={() => editor.chain().focus().run()}
      >
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
});

export default RichTextEditor;
