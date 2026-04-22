import type { TFunction } from "i18next";

export interface ErrorHint {
  title: string;
  suggestions: string[];
}

export function getComplexityLabel(
  t: TFunction,
  level: "low" | "medium" | "high",
): string {
  return t(`queryAssistant.results.complexity.${level}`);
}

export function getExecutionStateLabel(t: TFunction, state: string): string {
  const key = {
    active: "active",
    idle: "idle",
    "idle in transaction": "idleInTransaction",
    "idle in transaction (aborted)": "idleAborted",
    fastpath: "fastpath",
    disabled: "disabled",
    completed: "completed",
    error: "error",
  }[state];

  return key ? t(`queryAssistant.sqlRunner.state.${key}`) : state;
}

export function diagnoseSqlError(t: TFunction, error: string): ErrorHint | null {
  const lower = error.toLowerCase();

  if (
    lower.includes("must begin with select or with") ||
    lower.includes("not sql") ||
    (!lower.includes("syntax error") &&
      /^[a-z]/.test(error) &&
      !lower.startsWith("select") &&
      !lower.startsWith("with"))
  ) {
    return {
      title: t("queryAssistant.sqlRunner.errorTitles.explanationInsteadOfSql"),
      suggestions: [
        t("queryAssistant.sqlRunner.suggestions.explanationInsteadOfSql.first"),
        t("queryAssistant.sqlRunner.suggestions.explanationInsteadOfSql.second"),
        t("queryAssistant.sqlRunner.suggestions.explanationInsteadOfSql.third"),
      ],
    };
  }

  if (lower.includes("backtick")) {
    return {
      title: t("queryAssistant.sqlRunner.errorTitles.mysqlBackticks"),
      suggestions: [
        t("queryAssistant.sqlRunner.suggestions.mysqlBackticks.first"),
        t("queryAssistant.sqlRunner.suggestions.mysqlBackticks.second"),
        t("queryAssistant.sqlRunner.suggestions.mysqlBackticks.third"),
      ],
    };
  }

  if (lower.includes("syntax error")) {
    const match = error.match(/at or near "([^"]+)"/);
    const near = match?.[1];
    return {
      title: near
        ? t("queryAssistant.sqlRunner.errorTitles.syntaxErrorNear", {
            token: near,
          })
        : t("queryAssistant.sqlRunner.errorTitles.syntaxError"),
      suggestions: [
        t("queryAssistant.sqlRunner.suggestions.syntaxError.first"),
        t("queryAssistant.sqlRunner.suggestions.syntaxError.second"),
        t("queryAssistant.sqlRunner.suggestions.syntaxError.third"),
      ],
    };
  }

  if (
    lower.includes("statement timeout") ||
    lower.includes("canceling statement")
  ) {
    return {
      title: t("queryAssistant.sqlRunner.errorTitles.timeout"),
      suggestions: [
        t("queryAssistant.sqlRunner.suggestions.timeout.first"),
        t("queryAssistant.sqlRunner.suggestions.timeout.second"),
        t("queryAssistant.sqlRunner.suggestions.timeout.third"),
        t("queryAssistant.sqlRunner.suggestions.timeout.fourth"),
      ],
    };
  }

  if (lower.includes("relation") && lower.includes("does not exist")) {
    const match = error.match(/relation "([^"]+)" does not exist/);
    const table = match?.[1];
    return {
      title: table
        ? t("queryAssistant.sqlRunner.errorTitles.tableNotFoundNamed", {
            table,
          })
        : t("queryAssistant.sqlRunner.errorTitles.tableNotFound"),
      suggestions: [
        t("queryAssistant.sqlRunner.suggestions.tableNotFound.first"),
        t("queryAssistant.sqlRunner.suggestions.tableNotFound.second"),
        t("queryAssistant.sqlRunner.suggestions.tableNotFound.third"),
      ],
    };
  }

  if (lower.includes("column") && lower.includes("does not exist")) {
    const match = error.match(/column "([^"]+)" does not exist/);
    const column = match?.[1];
    return {
      title: column
        ? t("queryAssistant.sqlRunner.errorTitles.columnNotFoundNamed", {
            column,
          })
        : t("queryAssistant.sqlRunner.errorTitles.columnNotFound"),
      suggestions: [
        t("queryAssistant.sqlRunner.suggestions.columnNotFound.first"),
        t("queryAssistant.sqlRunner.suggestions.columnNotFound.second"),
        t("queryAssistant.sqlRunner.suggestions.columnNotFound.third"),
      ],
    };
  }

  if (
    lower.includes("permission denied") ||
    lower.includes("only administrators")
  ) {
    return {
      title: t("queryAssistant.sqlRunner.errorTitles.insufficientPermissions"),
      suggestions: [
        t("queryAssistant.sqlRunner.suggestions.insufficientPermissions.first"),
        t("queryAssistant.sqlRunner.suggestions.insufficientPermissions.second"),
        t("queryAssistant.sqlRunner.suggestions.insufficientPermissions.third"),
      ],
    };
  }

  return null;
}
