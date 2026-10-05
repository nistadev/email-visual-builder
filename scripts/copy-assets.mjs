import { cpSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

cpSync(`${root}/src/react/styles.css`, `${root}/dist/react/styles.css`);
