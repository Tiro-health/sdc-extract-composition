import { describe, it, expect } from "vitest";
import { formatContextExpression } from "./format";
import { parseContextExpression } from "./parse";
import type { ContextConfig } from "./types";
import type { QuestionnaireIndex, QuestionnaireItemInfo } from "../questionnaire-index";

function mockIndex(
  items: Record<string, { path: string; type: string; repeats?: boolean }>
): QuestionnaireIndex {
  const itemsMap = new Map<string, QuestionnaireItemInfo>();
  for (const [linkId, info] of Object.entries(items)) {
    itemsMap.set(linkId, {
      linkId,
      text: linkId,
      type: info.type,
      repeats: info.repeats ?? true,
      path: info.path,
      answerOptions: new Map(),
      answerCodings: new Map(),
    });
  }
  return {
    items: itemsMap,
    linkIdTextMap: new Map(),
    resolveItemText: (id) => itemsMap.get(id)?.text ?? null,
    resolveCodeDisplay: () => null,
    resolveAnswerCoding: () => null,
    listAnswerCodings: () => [],
    resolveItemType: (id) => itemsMap.get(id)?.type ?? null,
    resolveItemRepeats: (id) => itemsMap.get(id)?.repeats ?? false,
  };
}

describe("formatContextExpression", () => {
  describe("always mode", () => {
    it("formats always as empty string", () => {
      expect(formatContextExpression({ mode: "always" })).toBe("");
    });
  });

  describe("for-each mode", () => {
    it("formats for-each with context scope", () => {
      expect(
        formatContextExpression({ mode: "for-each", linkId: "medications", scope: "context" })
      ).toBe("%context.repeat(item).where(linkId='medications')");
    });

    it("formats for-each with resource scope", () => {
      expect(
        formatContextExpression({ mode: "for-each", linkId: "medications", scope: "resource" })
      ).toBe("%resource.repeat(item).where(linkId='medications')");
    });

    it("defaults to context scope", () => {
      expect(
        formatContextExpression({ mode: "for-each", linkId: "medications" })
      ).toBe("%context.repeat(item).where(linkId='medications')");
    });

    it("with index: repeating group iterates over items (no .answer)", () => {
      const index = mockIndex({
        medication: {
          path: "%resource.item.where(linkId='medications').item.where(linkId='medication')",
          type: "group",
        },
      });
      expect(
        formatContextExpression(
          { mode: "for-each", linkId: "medication", scope: "resource" },
          index
        )
      ).toBe("%resource.item.where(linkId='medications').item.where(linkId='medication')");
    });

    it("with index: repeating non-group question iterates over answers (.answer appended)", () => {
      const index = mockIndex({
        bloedverdunners: {
          path: "%resource.item.where(linkId='group').item.where(linkId='bloedverdunners')",
          type: "choice",
        },
      });
      expect(
        formatContextExpression(
          { mode: "for-each", linkId: "bloedverdunners", scope: "resource" },
          index
        )
      ).toBe(
        "%resource.item.where(linkId='group').item.where(linkId='bloedverdunners').answer"
      );
    });

    it("with index: context-scoped non-group appends .answer", () => {
      const index = mockIndex({
        bloedverdunners: {
          path: "%resource.item.where(linkId='group').item.where(linkId='bloedverdunners')",
          type: "choice",
        },
      });
      expect(
        formatContextExpression(
          { mode: "for-each", linkId: "bloedverdunners", scope: "context" },
          index
        )
      ).toBe(
        "%context.item.where(linkId='group').item.where(linkId='bloedverdunners').answer"
      );
    });
  });

  describe("if mode", () => {
    it("formats empty conditions as empty string", () => {
      expect(
        formatContextExpression({ mode: "if", combineMode: "and", conditions: [] })
      ).toBe("");
    });

    it("formats exists condition with resource scope", () => {
      expect(
        formatContextExpression({
          mode: "if",
          combineMode: "and",
          conditions: [{ linkId: "allergie", operator: "exists", scope: "resource" }],
        })
      ).toBe("%context.where(%resource.repeat(item).where(linkId='allergie').answer.exists())");
    });

    it("formats exists condition with context scope", () => {
      expect(
        formatContextExpression({
          mode: "if",
          combineMode: "and",
          conditions: [{ linkId: "allergie", operator: "exists", scope: "context" }],
        })
      ).toBe("%context.where(%context.item.where(linkId='allergie').answer.exists())");
    });

    it("formats not-exists condition", () => {
      expect(
        formatContextExpression({
          mode: "if",
          combineMode: "and",
          conditions: [{ linkId: "allergie", operator: "not-exists", scope: "resource" }],
        })
      ).toBe("%context.where(%resource.repeat(item).where(linkId='allergie').answer.exists().not())");
    });

    it("formats equals condition", () => {
      expect(
        formatContextExpression({
          mode: "if",
          combineMode: "and",
          conditions: [
            {
              linkId: "type",
              operator: "equals",
              scope: "resource",
              value: { system: "http://snomed", code: "123" },
            },
          ],
        })
      ).toBe(
        "%context.where(%resource.repeat(item).where(linkId='type').answer.value ~ %factory.Coding('http://snomed', '123'))"
      );
    });

    it("formats not-equals condition", () => {
      expect(
        formatContextExpression({
          mode: "if",
          combineMode: "and",
          conditions: [
            {
              linkId: "type",
              operator: "not-equals",
              scope: "resource",
              value: { system: "http://snomed", code: "123" },
            },
          ],
        })
      ).toBe(
        "%context.where((%resource.repeat(item).where(linkId='type').answer.value ~ %factory.Coding('http://snomed', '123')).not())"
      );
    });

    it("formats multiple AND conditions", () => {
      expect(
        formatContextExpression({
          mode: "if",
          combineMode: "and",
          conditions: [
            { linkId: "a", operator: "exists", scope: "resource" },
            { linkId: "b", operator: "exists", scope: "resource" },
          ],
        })
      ).toBe(
        "%context.where(%resource.repeat(item).where(linkId='a').answer.exists() and %resource.repeat(item).where(linkId='b').answer.exists())"
      );
    });

    it("formats multiple OR conditions", () => {
      expect(
        formatContextExpression({
          mode: "if",
          combineMode: "or",
          conditions: [
            { linkId: "a", operator: "exists", scope: "resource" },
            { linkId: "b", operator: "exists", scope: "resource" },
          ],
        })
      ).toBe(
        "%context.where(%resource.repeat(item).where(linkId='a').answer.exists() or %resource.repeat(item).where(linkId='b').answer.exists())"
      );
    });
  });

  describe("custom mode", () => {
    it("returns expression as-is", () => {
      expect(
        formatContextExpression({ mode: "custom", expression: "some.custom.path" })
      ).toBe("some.custom.path");
    });
  });
});

describe("round-trip", () => {
  const configs: ContextConfig[] = [
    { mode: "always" },
    { mode: "for-each", linkId: "meds", scope: "context" },
    { mode: "for-each", linkId: "meds", scope: "resource" },
    { mode: "if", combineMode: "and", conditions: [{ linkId: "x", operator: "exists", scope: "resource" }] },
    { mode: "if", combineMode: "and", conditions: [{ linkId: "x", operator: "exists", scope: "context" }] },
    { mode: "if", combineMode: "and", conditions: [{ linkId: "x", operator: "not-exists", scope: "resource" }] },
    {
      mode: "if",
      combineMode: "and",
      conditions: [{ linkId: "x", operator: "equals", scope: "resource", value: { system: "sys", code: "c" } }],
    },
    {
      mode: "if",
      combineMode: "or",
      conditions: [
        { linkId: "a", operator: "exists", scope: "resource" },
        { linkId: "b", operator: "not-exists", scope: "context" },
      ],
    },
  ];

  it.each(configs)("format then parse returns same config: %j", (config) => {
    const formatted = formatContextExpression(config);
    const parsed = parseContextExpression(formatted);
    expect(parsed).toEqual(config);
  });
});
