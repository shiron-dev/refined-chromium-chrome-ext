import { describe, expect, it } from "vitest";
import { fuzzyFilter, fuzzyScore } from "../../modules/command-palette/fuzzy";

// ---------------------------------------------------------------------------
// 基本一致
// ---------------------------------------------------------------------------

describe("基本一致 / 完全一致", () => {
  it("完全一致候補がfuzzyFilterで最上位になる", () => {
    // "apple" query: "apple" exact match, "applet" prefix, "pineapple" suffix
    // All three are valid subsequence matches; exact match must rank first
    const results = fuzzyFilter("apple", ["applet", "pineapple", "apple"], s => s);
    expect(results[0]).toBe("apple");
  });

  it("完全一致スコアは前方一致・末尾一致より高い", () => {
    const exact = fuzzyScore("apple", "apple")!;    // exact
    const prefix = fuzzyScore("apple", "applet")!;  // "apple" is prefix of "applet"
    const suffix = fuzzyScore("apple", "pineapple")!; // "apple" is suffix of "pineapple"
    expect(exact).toBeGreaterThan(prefix);
    expect(exact).toBeGreaterThan(suffix);
  });

  it("完全一致はnullを返さない", () => {
    expect(fuzzyScore("apple", "apple")).not.toBeNull();
  });
});

describe("基本一致 / 前方一致", () => {
  it("前方一致候補がヒットする", () => {
    expect(fuzzyScore("app", "apple")).not.toBeNull();
    expect(fuzzyScore("app", "application")).not.toBeNull();
  });
});

describe("基本一致 / 部分一致", () => {
  it("中間部分文字列もヒットする", () => {
    // "pli" is a substring of "application" at positions a-p-p-l-i...
    expect(fuzzyScore("pli", "application")).not.toBeNull();
  });
});

describe("基本一致 / 非連続一致", () => {
  it("サブシーケンスとしてヒットする", () => {
    expect(fuzzyScore("apn", "application")).not.toBeNull();
    expect(fuzzyScore("apn", "append")).not.toBeNull();
  });
});

describe("基本一致 / 不一致", () => {
  it("存在しない文字列はnullを返す", () => {
    expect(fuzzyScore("zzz", "apple")).toBeNull();
    expect(fuzzyScore("zzz", "banana")).toBeNull();
  });

  it("不一致クエリでfuzzyFilterすると0件", () => {
    const result = fuzzyFilter("zzz", ["apple", "banana", "cherry"], s => s);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// スコア・順位
// ---------------------------------------------------------------------------

describe("スコア・順位 / 短い候補を優先", () => {
  it("query: abc — abc が abcde より高スコア", () => {
    const short = fuzzyScore("abc", "abc")!;
    const long = fuzzyScore("abc", "abcde")!;
    expect(short).toBeGreaterThan(long);
  });
});

describe("スコア・順位 / 連続一致を優先", () => {
  it("query: app — apple が a_p_p_helper より高スコア", () => {
    const consec = fuzzyScore("app", "apple")!;
    const sparse = fuzzyScore("app", "a_p_p_helper")!;
    expect(consec).toBeGreaterThan(sparse);
  });
});

describe("スコア・順位 / 先頭一致を優先", () => {
  it("query: cat — catalog が my_cat_log より高スコア", () => {
    const head = fuzzyScore("cat", "catalog")!;
    const middle = fuzzyScore("cat", "my_cat_log")!;
    expect(head).toBeGreaterThan(middle);
  });
});

describe("スコア・順位 / 単語境界一致を優先", () => {
  it("query: fb — fooBar が foobar より高スコア (camelCase境界ボーナス)", () => {
    const camel = fuzzyScore("fb", "fooBar")!;
    const flat = fuzzyScore("fb", "foobar")!;
    expect(camel).toBeGreaterThan(flat);
  });
});

describe("スコア・順位 / camelCase / snake_case / kebab-case の優遇", () => {
  it("query: guc — getUserCount にヒット", () => {
    expect(fuzzyScore("guc", "getUserCount")).not.toBeNull();
  });

  it("query: guc — get_user_count にヒット", () => {
    expect(fuzzyScore("guc", "get_user_count")).not.toBeNull();
  });

  it("query: guc — get-user-count にヒット", () => {
    expect(fuzzyScore("guc", "get-user-count")).not.toBeNull();
  });

  it("word-boundary版 (getUserCount) が flat 版 (getusercount) より高スコア", () => {
    const boundary = fuzzyScore("guc", "getUserCount")!;
    const flat = fuzzyScore("guc", "getusercount")!;
    expect(boundary).toBeGreaterThan(flat);
  });
});

// ---------------------------------------------------------------------------
// 大文字小文字
// ---------------------------------------------------------------------------

describe("大文字小文字 / case insensitive (デフォルト)", () => {
  it("小文字クエリが大文字候補にヒット", () => {
    expect(fuzzyScore("apple", "APPLE")).not.toBeNull();
    expect(fuzzyScore("apple", "Apple")).not.toBeNull();
  });

  it("大文字クエリが小文字候補にヒット", () => {
    expect(fuzzyScore("APP", "apple")).not.toBeNull();
  });

  it("app と APP は同じスコアを返す", () => {
    const lower = fuzzyScore("app", "apple");
    const upper = fuzzyScore("APP", "apple");
    expect(lower).toBe(upper);
  });
});

describe("大文字小文字 / case sensitive モード", () => {
  it("APIClient は caseSensitive:true で API クエリにヒット", () => {
    expect(
      fuzzyScore("API", "APIClient", { caseSensitive: true }),
    ).not.toBeNull();
  });

  it("caseSensitive:true のとき APIClient が apiClient より高スコア (または apiClient は不一致)", () => {
    const apiClient = fuzzyScore("API", "apiClient", { caseSensitive: true });
    const APIClient = fuzzyScore("API", "APIClient", { caseSensitive: true });
    expect(APIClient).not.toBeNull();
    if (apiClient !== null) {
      expect(APIClient!).toBeGreaterThan(apiClient);
    }
  });
});

// ---------------------------------------------------------------------------
// 空文字・null系
// ---------------------------------------------------------------------------

describe("空文字・null 系", () => {
  it("空クエリはスコア0を返す", () => {
    expect(fuzzyScore("", "apple")).toBe(0);
  });

  it("空白のみのクエリはスコア0を返す", () => {
    expect(fuzzyScore("   ", "apple")).toBe(0);
  });

  it("空クエリでfuzzyFilterすると全件返る", () => {
    const items = ["apple", "banana", "cherry"];
    expect(fuzzyFilter("", items, s => s)).toEqual(items);
  });

  it("空文字 candidate はnullを返す", () => {
    expect(fuzzyScore("app", "")).toBeNull();
  });

  it("candidate が null はnullを返す", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(fuzzyScore("app", null as any)).toBeNull();
  });

  it("candidate が undefined はnullを返す", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(fuzzyScore("app", undefined as any)).toBeNull();
  });

  it("query が null はスコア0を返す", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(fuzzyScore(null as any, "apple")).toBe(0);
  });

  it("candidates が空配列なら0件", () => {
    expect(fuzzyFilter("app", [], s => s)).toHaveLength(0);
  });

  it("候補に空文字が含まれても例外を投げない", () => {
    expect(() =>
      fuzzyFilter("app", ["apple", "", "application"], s => s),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 重複
// ---------------------------------------------------------------------------

describe("重複", () => {
  it("同一候補が複数あっても重複を維持する", () => {
    const result = fuzzyFilter("app", ["apple", "apple"], s => s);
    expect(result).toHaveLength(2);
  });

  it("同スコアの候補は元の並び順を維持する (安定ソート)", () => {
    // 同じ長さ・同じ一致位置 → 同スコア
    const items = ["abc1", "abc2", "abc3"];
    const result = fuzzyFilter("abc", items, s => s);
    expect(result).toEqual(items);
  });
});

// ---------------------------------------------------------------------------
// 記号・空白
// ---------------------------------------------------------------------------

describe("記号・空白", () => {
  it("スペース区切りクエリ: 各トークンが独立してヒット", () => {
    expect(fuzzyScore("foo bar", "foo bar")).not.toBeNull();
    expect(fuzzyScore("foo bar", "foobar")).not.toBeNull();
    expect(fuzzyScore("foo bar", "foo_bar")).not.toBeNull();
  });

  it("不一致トークンがあれば全体がnull", () => {
    expect(fuzzyScore("foo zzz", "foobar")).toBeNull();
  });

  it("連続スペースは通常スペースと同等", () => {
    const s1 = fuzzyScore("foo bar", "foobar");
    const s2 = fuzzyScore("foo  bar", "foobar");
    expect(s1).toEqual(s2);
  });

  it("前後空白はtrimされる", () => {
    const s1 = fuzzyScore("app", "apple");
    const s2 = fuzzyScore("  app  ", "apple");
    expect(s1).toEqual(s2);
  });

  it("記号を含む候補にヒットする", () => {
    expect(fuzzyScore("fb", "foo/bar")).not.toBeNull();
    expect(fuzzyScore("fb", "foo.bar")).not.toBeNull();
    expect(fuzzyScore("fb", "foo-bar")).not.toBeNull();
    expect(fuzzyScore("fb", "foo_bar")).not.toBeNull();
  });

  it("区切り文字直後はword-boundaryなのでスコアが高い", () => {
    // "fb" → "foo/bar": 'b' is after '/' (boundary)
    // "fb" → "foobaz": 'b' at pos 3 is NOT a boundary
    const withBoundary = fuzzyScore("fb", "foo/bar")!;
    const withoutBoundary = fuzzyScore("fb", "foobaz")!;
    expect(withBoundary).toBeGreaterThan(withoutBoundary);
  });
});

// ---------------------------------------------------------------------------
// 日本語・Unicode
// ---------------------------------------------------------------------------

describe("日本語・Unicode", () => {
  it("ひらがなクエリが完全一致でヒット", () => {
    expect(fuzzyScore("とうきょう", "とうきょう")).not.toBeNull();
  });

  it("ひらがなのサブシーケンスがヒット", () => {
    expect(fuzzyScore("とき", "とうきょう")).not.toBeNull();
  });

  it("ひらがな不一致はnull", () => {
    expect(fuzzyScore("おおさか", "とうきょう")).toBeNull();
  });

  it("全角半角正規化 (NFKC): ａｂｃ と abc は同スコア", () => {
    const half = fuzzyScore("abc", "abcde");
    const full = fuzzyScore("ａｂｃ", "abcde"); // full-width ASCII
    expect(half).toEqual(full);
  });

  it("全角スペースを含むクエリが落ちない", () => {
    expect(() => fuzzyScore("foo　bar", "foobar")).not.toThrow();
  });

  it("絵文字を含むクエリが例外を投げない", () => {
    expect(() => fuzzyScore("😀", "hello 😀 world")).not.toThrow();
  });

  it("絵文字完全一致がヒット", () => {
    expect(fuzzyScore("😀", "hello 😀 world")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// パス・ファイル名検索
// ---------------------------------------------------------------------------

describe("パス・ファイル名検索", () => {
  it("query: indtsx — src/index.tsx がヒットする", () => {
    // i-n-d in 'index', t-s-x in '.tsx' — consecutive runs
    expect(fuzzyScore("indtsx", "src/index.tsx")).not.toBeNull();
  });

  it("query: indtsx — src/index.tsx が docs/intro-indexing.md より高い (またはdocsは不一致)", () => {
    const idx = fuzzyScore("indtsx", "src/index.tsx");
    const intro = fuzzyScore("indtsx", "docs/intro-indexing.md");
    expect(idx).not.toBeNull();
    if (intro !== null) {
      expect(idx!).toBeGreaterThan(intro);
    }
  });

  it("浅いパスを深いパスより優先: src/app.ts > packages/core/src/app.ts", () => {
    const shallow = fuzzyScore("app", "src/app.ts")!;
    const deep = fuzzyScore("app", "packages/core/src/app.ts")!;
    expect(shallow).toBeGreaterThan(deep);
  });

  it("ディレクトリ境界ボーナス: src/utils/test.ts が status.txt より高スコア (query: sut)", () => {
    // 's' → start of src (boundary+start)
    // 'u' → start of utils (boundary after '/')
    // 't' → start of test (boundary after '/')
    const path = fuzzyScore("sut", "src/utils/test.ts")!;
    const file = fuzzyScore("sut", "status.txt")!;
    expect(path).toBeGreaterThan(file);
  });

  it("ファイル名先頭一致が深い階層内の部分一致より高い", () => {
    // query: "app" — "app.ts" at root vs "application/src/app.ts" deeply nested
    const root = fuzzyScore("app", "src/app.ts")!;
    const nested = fuzzyScore("app", "project/application/components/app.ts")!;
    expect(root).toBeGreaterThan(nested);
  });
});

// ---------------------------------------------------------------------------
// fuzzyFilter の統合動作
// ---------------------------------------------------------------------------

describe("fuzzyFilter 統合", () => {
  it("スコア順に降順ソートされる", () => {
    const items = ["my_cat_log", "catalog", "category"];
    const result = fuzzyFilter("cat", items, s => s);
    // catalog と category は先頭一致, my_cat_log は中間 → catalogが上位になるはず
    const catalogIdx = result.indexOf("catalog");
    const myCatIdx = result.indexOf("my_cat_log");
    expect(catalogIdx).toBeLessThan(myCatIdx);
  });

  it("マッチしない候補は除外される", () => {
    const items = ["apple", "banana", "cherry", "apricot"];
    const result = fuzzyFilter("zzz", items, s => s);
    expect(result).toHaveLength(0);
  });

  it("全件マッチするクエリは全件返す (空クエリ)", () => {
    const items = ["apple", "banana", "cherry"];
    expect(fuzzyFilter("", items, s => s)).toHaveLength(3);
  });

  it("getKey でオブジェクトのフィールドを指定できる", () => {
    const items = [
      { id: 1, name: "apple" },
      { id: 2, name: "banana" },
    ];
    const result = fuzzyFilter("app", items, item => item.name);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });
});
