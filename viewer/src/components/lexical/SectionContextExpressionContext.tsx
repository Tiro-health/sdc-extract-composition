import { createContext, useContext } from "react";

/**
 * The effective ``templateExtractContext`` for the section currently being
 * rendered or edited, used to resolve ``%context`` inside placeholder
 * expressions when computing pill labels.
 *
 * ``null`` means "no narrowing" (i.e. ``%context`` is equivalent to
 * ``%resource``); pill rendering can skip resolution in that case.
 */
const SectionContextExpressionContext = createContext<string | null>(null);

export const SectionContextExpressionProvider = SectionContextExpressionContext.Provider;

export function useSectionContextExpression(): string | null {
  return useContext(SectionContextExpressionContext);
}
