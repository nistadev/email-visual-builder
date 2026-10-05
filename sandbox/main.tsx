// A host with no Tailwind and no daisyUI: the only stylesheet is the
// standalone one. Run `pnpm build && pnpm sandbox`.
import { createRoot } from "react-dom/client";
import "../dist/react/standalone.css";
import {
  BuilderController,
  createStarterDocument,
  DEFAULT_BUILDER_REGISTRIES,
} from "../src/core/index.js";
import { EmailVisualBuilder } from "../src/react/index.js";

const registries = DEFAULT_BUILDER_REGISTRIES;
const controller = new BuilderController(
  createStarterDocument("email", registries),
  { registries },
);

createRoot(document.getElementById("root")!).render(
  <EmailVisualBuilder
    controller={controller}
    registries={registries}
    senderName="Donativus"
    senderEmail="hello@donativus.com"
    subject="A little goes a long way"
  />,
);
