# Circom チートシート

Circom は、ゼロ知識証明のための算術回路を定義するためのドメイン固有言語です。このチートシートは、Circomプログラミングの主要な概念と構文をまとめたものです。

## 1. 基本構造

### ファイル構造と宣言

```circom
pragma circom 2.0.0;  // バージョン宣言（必須）

// インクルード
include "path/to/file.circom";

// メインコンポーネント宣言（必須）
component main {public [in1, in2]} = MyTemplate(param1, param2);
```

### テンプレート定義

```circom
// 基本的なテンプレート定義
template MyTemplate(param1, param2) {
    // シグナル宣言
    signal input in1;
    signal input in2;
    signal output out;

    // 中間シグナル
    signal intermediate;

    // ロジック実装
    intermediate <== in1 * param1;
    out <== intermediate + in2 * param2;
}

// 並列処理のためのテンプレートタグ (C++ウィットネスジェネレータでのみ有効)
template parallel ParallelTemplate(...) {
    // ...
}

// カスタムテンプレート (PLONK用)
pragma custom_templates;  // 必須
template custom CustomTemplate() {
    // ...
}
```

## 2. シグナル

### シグナルの種類と宣言

```circom
// 基本的なシグナル宣言
signal input in;           // 入力シグナル
signal output out;         // 出力シグナル
signal intermediate;       // 中間シグナル

// 配列シグナル
signal input inArray[n];   // n次元の入力配列
signal output outMatrix[n][m];  // 2次元配列

// シグナル宣言と同時に初期化 (2.0.4以降)
signal output out <== in1 * in2;
```

### シグナルの特性

- シグナルは不変(immutable): 一度値が割り当てられたら変更できない
- シグナルは有限体 Z/pZ 上の要素を含む
- 入力シグナルは外部から値を受け取る
- 出力シグナルのみコンポーネント外部からアクセス可能
- 中間シグナルはコンポーネント内でのみ可視

### シグナルの割り当て

```circom
// 制約を追加する安全な割り当て (推奨)
out <== in * 5;      // 左辺に割り当て
in * 5 ==> out;      // 右辺に割り当て

// 制約を追加しない危険な割り当て (要注意)
out <-- (in >> 2) & 1;   // R1CSに含められない演算で使用
out === (in >> 2) & 1;   // 制約を明示的に追加する必要がある
```

## 3. コンポーネント

### コンポーネントのインスタンス化

```circom
// 基本的なコンポーネント宣言と初期化
component c = MyTemplate(param1, param2);

// 別々に宣言と初期化
component c;
c = MyTemplate(param1, param2);

// 条件付き初期化 (同じテンプレートである必要がある)
if (condition) {
    c = MyTemplate(param1, param2);
} else {
    c = MyTemplate(param3, param4);
}

// 並列処理用インスタンス化
component pc = parallel MyTemplate(param1, param2);
```

### コンポーネント配列

```circom
// コンポーネント配列の宣言
component multipliers[n];

// 各コンポーネントの初期化
for (var i = 0; i < n; i++) {
    multipliers[i] = Multiplier();
}

// 並列コンポーネント配列
for (var i = 0; i < n; i++) {
    multipliers[i] = parallel Multiplier();
}
```

### コンポーネントの接続

```circom
// ドット記法でシグナルにアクセス
c.in <== x;
y <== c.out;

// 配列コンポーネントの接続
for (var i = 0; i < n; i++) {
    multipliers[i].in <== inputs[i];
    outputs[i] <== multipliers[i].out;
}
```

## 4. 演算子と制約

### 算術演算子

```circom
// 基本的な算術演算
z = x + y;    // 加算
z = x - y;    // 減算
z = x * y;    // 乗算
z = x \ y;    // 整数除算 (除算ではなく整数商)
z = x % y;    // 剰余
z = x ** y;   // べき乗 (yは定数である必要あり)
```

### 比較演算子

```circom
// 比較演算 (条件文でのみ使用可能)
z = x == y;   // 等価
z = x != y;   // 非等価
z = x < y;    // 未満
z = x <= y;   // 以下
z = x > y;    // より大きい
z = x >= y;   // 以上
```

### 論理演算子

```circom
// 論理演算
z = x && y;   // 論理積 (AND)
z = x || y;   // 論理和 (OR)
z = !x;       // 否定 (NOT)
```

### ビット演算子

```circom
// ビット演算
z = x & y;    // ビットごとのAND
z = x | y;    // ビットごとのOR
z = x ^ y;    // ビットごとのXOR
z = ~x;       // ビットごとのNOT
z = x << y;   // 左シフト (yは定数である必要あり)
z = x >> y;   // 右シフト (yは定数である必要あり)
```

### 制約の追加

```circom
// 単純な制約
x === y;       // xとyが等しいという制約

// 複雑な制約の例
a * b === c;   // a*bがcに等しいという制約
```

## 5. 制御構造

### 条件分岐

```circom
// if文
if (condition) {
    // 条件が真のときの処理
} else if (another_condition) {
    // 別の条件が真のときの処理
} else {
    // どの条件も真でないときの処理
}
```

### ループ

```circom
// for ループ
for (var i = 0; i < n; i++) {
    // 反復処理
}

// while ループ
var i = 0;
while (i < n) {
    // 反復処理
    i++;
}
```

## 6. データ型

### 基本型

- `var`: 変数 (コンパイル時に値が確定する必要がある)
- `signal`: シグナル (回路の入出力と中間値)
- `component`: コンポーネント

### 配列

```circom
// 配列の宣言
var array[5];
var matrix[3][3];

// 配列の初期化
var array[3] = [1, 2, 3];
var matrix[2][2] = [[1, 2], [3, 4]];

// 配列アクセス
array[0] = 5;
x = matrix[1][1];
```

## 7. 関数

```circom
// 関数定義
function factorial(n) {
    if (n == 0) {
        return 1;
    }
    return n * factorial(n - 1);
}

// 関数使用
var result = factorial(5);
```

## 8. 実用的なパターン

### 範囲チェック

```circom
// 値が範囲内にあることを検証
template CheckRange(n) {
    signal input in;
    signal output out;

    // in が 0〜n-1 の範囲内にあることを確認
    component lt = LessThan(32);  // circomlibから
    lt.in[0] <== in;
    lt.in[1] <== n;
    lt.out === 1;

    out <== in;
}
```

### ビット分解

```circom
// 数値をビットに分解
template ToBits(n) {
    signal input in;
    signal output bits[n];

    var acc = 0;

    for (var i = 0; i < n; i++) {
        bits[i] <-- (in >> i) & 1;
        bits[i] * (1 - bits[i]) === 0;  // bits[i]は0か1
        acc += bits[i] * (2 ** i);
    }

    acc === in;  // 分解が正しいことを検証
}
```

### 入力の有効性検証

```circom
// 入力が有効なバイナリ値であることを確認
template ValidateBinary() {
    signal input in;

    // inは0か1でなければならない
    in * (1 - in) === 0;
}
```

## 9. 重要な注意点

1. シグナルは一度だけ値を割り当てることができる（不変）
2. コンポーネントインスタンス化のパラメータはコンパイル時に決定される必要がある
3. すべての入力シグナルに値が割り当てられるまでコンポーネントのインスタンス化は完了しない
4. 常に `<==` または `==>` を使って制約を追加する（`<--` や `-->` は特殊なケースのみ）
5. カスタムテンプレートは制約を導入できず、サブコンポーネントも宣言できない
6. メインコンポーネントの出力シグナルはすべて公開され、入力シグナルは明示的に公開する必要がある

## 10. コンパイルと実行

### コマンドライン

```bash
# 回路のコンパイル
circom circuit.circom --r1cs --wasm --sym

# R1CSファイルの生成
# circuit.r1cs - 制約システム

# Witness生成コードの生成
# circuit_js - JavaScriptコード
# circuit.wasm - WebAssemblyコード

# シンボルファイルの生成
# circuit.sym - シンボル情報
```

### SnarkJSとの連携

```javascript
// SnarkJSを使用してゼロ知識証明を生成/検証
const { groth16 } = require("snarkjs");

async function generateProof() {
    const { proof, publicSignals } = await groth16.fullProve(
        { input: 123 }, // 入力
        "circuit.wasm", // 回路WASM
        "circuit_0001.zkey" // 証明鍵
    );

    const verified = await groth16.verify(
        verificationKey, // 検証鍵
        publicSignals, // 公開入出力
        proof // 証明
    );

    return { proof, publicSignals, verified };
}
```
