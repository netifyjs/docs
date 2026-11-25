import type { ThemeRegistration } from 'shiki'

/**
 * Colours for one mode of the code theme
 */
type Palette = {
  /**
   * Plain code
   */
  readonly text: string

  /**
   * Comments
   */
  readonly comment: string

  /**
   * Keywords, shown bold
   */
  readonly accent: string

  /**
   * Types and numbers
   */
  readonly soft: string

  /**
   * Strings
   */
  readonly string: string

  /**
   * Function names
   */
  readonly name: string

  /**
   * Brackets and operators
   */
  readonly punctuation: string

  /**
   * Background
   */
  readonly background: string
}

/**
 * Builds a black and white theme
 * @param id the theme name
 * @param type light or dark
 * @param palette its colours
 */
const themeOf = (
  id: string,
  type: 'light' | 'dark',
  palette: Palette,
): ThemeRegistration => ({
  name: id,
  type,
  colors: {
    'editor.background': palette.background,
    'editor.foreground': palette.text,
  },
  settings: [
    { settings: { foreground: palette.text } },
    {
      scope: [
        'comment',
        'punctuation.definition.comment',
        'comment.block.documentation',
      ],
      settings: { foreground: palette.comment, fontStyle: 'italic' },
    },
    {
      scope: [
        'keyword',
        'storage',
        'storage.type',
        'storage.modifier',
        'keyword.control',
        'keyword.operator.new',
        'variable.language.this',
      ],
      settings: { foreground: palette.accent, fontStyle: 'bold' },
    },
    {
      scope: ['string', 'string.quoted'],
      settings: { foreground: palette.string },
    },
    {
      scope: [
        'constant.numeric',
        'constant.language',
        'entity.name.type',
        'entity.name.class',
        'support.type',
        'entity.other.inherited-class',
        'support.class',
      ],
      settings: { foreground: palette.soft },
    },
    {
      scope: ['entity.name.function', 'support.function'],
      settings: { foreground: palette.name },
    },
    {
      scope: ['punctuation', 'meta.brace', 'keyword.operator'],
      settings: { foreground: palette.punctuation },
    },
    {
      scope: [
        'storage.type.class.jsdoc',
        'punctuation.definition.block.tag.jsdoc',
      ],
      settings: { foreground: palette.accent },
    },
  ],
})

/**
 * Dark mode, grey code with white keywords and names
 */
export const THEME_DARK: ThemeRegistration = themeOf('netify-dark', 'dark', {
  text: '#9a9a9a',
  comment: '#4d4d4d',
  accent: '#ffffff',
  soft: '#cfcfcf',
  string: '#7d7d7d',
  name: '#ffffff',
  punctuation: '#555555',
  background: '#0a0a0a',
})

/**
 * Light mode, greys with bold black keywords
 */
export const THEME_LIGHT: ThemeRegistration = themeOf('netify-light', 'light', {
  text: '#3f3f46',
  comment: '#a1a1aa',
  accent: '#000000',
  soft: '#18181b',
  string: '#71717a',
  name: '#09090b',
  punctuation: '#a1a1aa',
  background: '#ffffff',
})
