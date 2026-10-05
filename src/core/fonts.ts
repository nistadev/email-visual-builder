// The one catalogue of font choices, shared by the block typography field
// and the inline run control. Every entry is a system font stack: nothing is
// fetched, so an export never makes a third-party request and a mail client
// that strips remote fonts loses nothing. The face a recipient sees is the
// first installed family in the stack, which is why each stack names the
// Apple, Windows and generic equivalents in turn.
//
// A family name never contains a word starting with a digit: the renderers
// strip quotes from style values, and an unquoted `Bodoni 72` is not a valid
// family, which would void the whole declaration.

export type FontGroup = "sans-serif" | "serif" | "monospace" | "script";

export interface FontOption {
  value: string;
  label: string;
  group: FontGroup;
}

export const FONT_GROUPS: readonly FontGroup[] = [
  "sans-serif",
  "serif",
  "monospace",
  "script",
];

export const FONT_CATALOGUE: readonly FontOption[] = [
  { value: "sans-serif", label: "System sans-serif", group: "sans-serif" },
  { value: "Arial, sans-serif", label: "Arial", group: "sans-serif" },
  {
    value: '"Arial Black", "Arial Bold", Gadget, sans-serif',
    label: "Arial Black",
    group: "sans-serif",
  },
  {
    value: '"Arial Narrow", "Helvetica Neue Condensed", Arial, sans-serif',
    label: "Arial Narrow",
    group: "sans-serif",
  },
  {
    value: "Helvetica, Arial, sans-serif",
    label: "Helvetica",
    group: "sans-serif",
  },
  {
    value: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    label: "Helvetica Neue",
    group: "sans-serif",
  },
  { value: "Verdana, sans-serif", label: "Verdana", group: "sans-serif" },
  { value: "Tahoma, sans-serif", label: "Tahoma", group: "sans-serif" },
  {
    value: '"Trebuchet MS", sans-serif',
    label: "Trebuchet MS",
    group: "sans-serif",
  },
  {
    value: "Geneva, Tahoma, Verdana, sans-serif",
    label: "Geneva",
    group: "sans-serif",
  },
  {
    value: '"Lucida Sans Unicode", "Lucida Grande", "Lucida Sans", sans-serif',
    label: "Lucida Sans",
    group: "sans-serif",
  },
  {
    value: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
    label: "Segoe UI",
    group: "sans-serif",
  },
  {
    value: 'Calibri, Candara, "Segoe UI", Arial, sans-serif',
    label: "Calibri",
    group: "sans-serif",
  },
  {
    value: 'Candara, Calibri, "Segoe UI", Optima, sans-serif',
    label: "Candara",
    group: "sans-serif",
  },
  {
    value: '"Century Gothic", "Apple Gothic", Futura, sans-serif',
    label: "Century Gothic",
    group: "sans-serif",
  },
  {
    value: '"Franklin Gothic Medium", "Arial Narrow", Arial, sans-serif',
    label: "Franklin Gothic",
    group: "sans-serif",
  },
  {
    value: '"Gill Sans", "Gill Sans MT", Calibri, sans-serif',
    label: "Gill Sans",
    group: "sans-serif",
  },
  {
    value: 'Optima, Candara, "Segoe UI", sans-serif',
    label: "Optima",
    group: "sans-serif",
  },
  {
    value: 'Futura, "Century Gothic", "Trebuchet MS", sans-serif',
    label: "Futura",
    group: "sans-serif",
  },
  {
    value: 'Avenir, "Avenir Next", "Segoe UI", Helvetica, sans-serif',
    label: "Avenir",
    group: "sans-serif",
  },
  {
    value: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
    label: "Impact",
    group: "sans-serif",
  },

  { value: "serif", label: "System serif", group: "serif" },
  { value: "Georgia, serif", label: "Georgia", group: "serif" },
  {
    value: '"Times New Roman", Times, serif',
    label: "Times New Roman",
    group: "serif",
  },
  {
    value: 'Garamond, "EB Garamond", "Apple Garamond", Baskerville, serif',
    label: "Garamond",
    group: "serif",
  },
  {
    value: 'Palatino, "Palatino Linotype", "Book Antiqua", serif',
    label: "Palatino",
    group: "serif",
  },
  {
    value: '"Book Antiqua", Palatino, "Palatino Linotype", serif',
    label: "Book Antiqua",
    group: "serif",
  },
  {
    value: 'Baskerville, "Baskerville Old Face", Garamond, serif',
    label: "Baskerville",
    group: "serif",
  },
  {
    value: '"Bodoni MT", "Bodoni Moda", Didot, serif',
    label: "Bodoni",
    group: "serif",
  },
  {
    value: 'Didot, "Didot LT STD", "Bodoni MT", serif',
    label: "Didot",
    group: "serif",
  },
  {
    value: '"Hoefler Text", "Baskerville Old Face", Garamond, serif',
    label: "Hoefler Text",
    group: "serif",
  },
  {
    value: '"Big Caslon", "Book Antiqua", "Palatino Linotype", serif',
    label: "Caslon",
    group: "serif",
  },
  {
    value: 'Cambria, Georgia, "Times New Roman", serif',
    label: "Cambria",
    group: "serif",
  },
  {
    value: "Constantia, Georgia, Palatino, serif",
    label: "Constantia",
    group: "serif",
  },
  {
    value: 'Perpetua, Baskerville, "Big Caslon", serif',
    label: "Perpetua",
    group: "serif",
  },
  {
    value: '"Goudy Old Style", Garamond, "Big Caslon", serif',
    label: "Goudy Old Style",
    group: "serif",
  },
  {
    value: '"Bookman Old Style", Bookman, Georgia, serif',
    label: "Bookman",
    group: "serif",
  },
  {
    value: '"Century Schoolbook", "New Century Schoolbook", Georgia, serif',
    label: "Century Schoolbook",
    group: "serif",
  },
  {
    value: '"Lucida Bright", Georgia, serif',
    label: "Lucida Bright",
    group: "serif",
  },
  {
    value: 'Rockwell, "Courier Bold", Georgia, serif',
    label: "Rockwell",
    group: "serif",
  },
  {
    value: 'Copperplate, "Copperplate Gothic Light", Georgia, serif',
    label: "Copperplate",
    group: "serif",
  },

  { value: "monospace", label: "System monospace", group: "monospace" },
  {
    value: '"Courier New", monospace',
    label: "Courier New",
    group: "monospace",
  },
  {
    value: 'Courier, "Courier New", monospace',
    label: "Courier",
    group: "monospace",
  },
  {
    value: 'Consolas, Menlo, Monaco, "Courier New", monospace',
    label: "Consolas",
    group: "monospace",
  },
  {
    value: 'Menlo, Monaco, Consolas, "Courier New", monospace',
    label: "Menlo",
    group: "monospace",
  },
  {
    value: 'Monaco, Menlo, "Lucida Console", monospace',
    label: "Monaco",
    group: "monospace",
  },
  {
    value: '"Lucida Console", Monaco, monospace',
    label: "Lucida Console",
    group: "monospace",
  },
  {
    value: '"Andale Mono", Consolas, Monaco, monospace',
    label: "Andale Mono",
    group: "monospace",
  },

  { value: "cursive", label: "System script", group: "script" },
  {
    value: '"Snell Roundhand", "Edwardian Script ITC", "Segoe Script", cursive',
    label: "Snell Roundhand",
    group: "script",
  },
  {
    value: '"Edwardian Script ITC", "Snell Roundhand", "Segoe Script", cursive',
    label: "Edwardian Script",
    group: "script",
  },
  {
    value: 'Zapfino, "Snell Roundhand", "Edwardian Script ITC", cursive',
    label: "Zapfino",
    group: "script",
  },
  {
    value: '"Savoye LET", "Snell Roundhand", "Palace Script MT", cursive',
    label: "Savoye",
    group: "script",
  },
  {
    value:
      '"Palace Script MT", "Snell Roundhand", "Edwardian Script ITC", cursive',
    label: "Palace Script",
    group: "script",
  },
  {
    value:
      '"Kunstler Script", "Snell Roundhand", "Edwardian Script ITC", cursive',
    label: "Kunstler Script",
    group: "script",
  },
  {
    value: '"French Script MT", "Snell Roundhand", "Segoe Script", cursive',
    label: "French Script",
    group: "script",
  },
  {
    value: 'Vivaldi, "Apple Chancery", "Monotype Corsiva", cursive',
    label: "Vivaldi",
    group: "script",
  },
  {
    value:
      '"Apple Chancery", "Monotype Corsiva", "Lucida Calligraphy", cursive',
    label: "Apple Chancery",
    group: "script",
  },
  {
    value:
      '"Monotype Corsiva", "Apple Chancery", "Lucida Calligraphy", cursive',
    label: "Monotype Corsiva",
    group: "script",
  },
  {
    value:
      '"Lucida Calligraphy", "Apple Chancery", "Monotype Corsiva", cursive',
    label: "Lucida Calligraphy",
    group: "script",
  },
  {
    value: '"Brush Script MT", "Brush Script Std", "Segoe Script", cursive',
    label: "Brush Script",
    group: "script",
  },
  {
    value: 'Mistral, "Brush Script MT", "Segoe Script", cursive',
    label: "Mistral",
    group: "script",
  },
  {
    value: '"Freestyle Script", "Brush Script MT", "Segoe Script", cursive',
    label: "Freestyle Script",
    group: "script",
  },
  {
    value: '"Segoe Script", "Bradley Hand", "Lucida Handwriting", cursive',
    label: "Segoe Script",
    group: "script",
  },
  {
    value: '"Lucida Handwriting", "Segoe Script", "Bradley Hand", cursive',
    label: "Lucida Handwriting",
    group: "script",
  },
  {
    value: '"Bradley Hand", "Segoe Print", "Lucida Handwriting", cursive',
    label: "Bradley Hand",
    group: "script",
  },
  {
    value: '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive',
    label: "Segoe Print",
    group: "script",
  },
  {
    value: '"Marker Felt", "Segoe Print", "Comic Sans MS", cursive',
    label: "Marker Felt",
    group: "script",
  },
  {
    value: '"Comic Sans MS", "Comic Sans", "Chalkboard SE", cursive',
    label: "Comic Sans",
    group: "script",
  },
  {
    value: 'Chalkduster, "Marker Felt", "Comic Sans MS", cursive',
    label: "Chalkduster",
    group: "script",
  },
  {
    value: "Papyrus, fantasy",
    label: "Papyrus",
    group: "script",
  },
];

const FONT_VALUES: ReadonlySet<string> = new Set(
  FONT_CATALOGUE.map((option) => option.value),
);

export function isCatalogueFont(value: string): boolean {
  return FONT_VALUES.has(value);
}
