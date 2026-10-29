import { marked } from "marked";
import DOMPurify from "dompurify";
export function markdown(value) {
  return DOMPurify.sanitize(marked.parse(value));
}
