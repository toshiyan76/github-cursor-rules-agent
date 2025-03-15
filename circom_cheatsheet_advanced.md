# Circom チートシート（追加編）

## 11. Circomlib

[Circomlib](https://github.com/iden3/circomlib)はCircom用の標準ライブラリで、多くの有用なコンポーネントが含まれています。

### 主要なコンポーネント

```circom
include "circomlib/comparators.circom";
include "circomlib/bitify.circom";
include "circomlib/gates.circom";
include "circomlib/sha256/sha256.circom";
include "circomlib/mimcsponge.circom";
include "circomlib/poseidon.circom";
include "circomlib/eddsaposeidon.circom";
```

### 論理ゲート

```circom
// ANDゲート
component and = AND();
and.a <== x;
and.b <== y;
out <== and.out;

// ORゲート
component or = OR();
or.a <== x;
or.b <== y;
out <== or.out;

// XORゲート
component xor = XOR();
xor.a <== x;
xor.b <== y;
out <== xor.out;

// NOTゲート
component not = NOT();
not.in <== x;
out <== not.out;
```

### 比較コンポーネント

```circom
// 大小比較（a < b なら1、それ以外は0）
component lt = LessThan(n_bits);  // n_bits = 比較する数値のビット数
lt.in[0] <== a;
lt.in[1] <== b;
isLess <== lt.out;

// 等価比較（a == b なら1、それ以外は0）
component eq = IsEqual();
eq.in[0] <== a;
eq.in[1] <== b;
isEqual <== eq.out;

// ゼロチェック（in == 0 なら1、それ以外は0）
component isz = IsZero();
isz.in <== in;
isZero <== isz.out;
```

### 数値変換コンポーネント

```circom
// 数値をビット配列に変換（ビット分解）
component n2b = Num2Bits(n);  // n = ビット数
n2b.in <== value;
bits <== n2b.out;

// ビット配列を数値に変換
component b2n = Bits2Num(n);  // n = ビット数
b2n.in <== bits;
value <== b2n.out;
```

### 暗号コンポーネント

```circom
// SHA-256ハッシュ
component sha = Sha256(n_bytes);  // n_bytes = 入力バイト数
for (var i = 0; i < n_bytes; i++) {
    sha.in[i] <== input[i];
}
hash <== sha.out;

// Poseidonハッシュ
component poseidon = Poseidon(n_inputs);  // n_inputs = 入力数
for (var i = 0; i < n_inputs; i++) {
    poseidon.inputs[i] <== inputs[i];
}
hash <== poseidon.out;

// MiMC Spongeハッシュ
component mimc = MiMCSponge(n_inputs, outputLen, k);
for (var i = 0; i < n_inputs; i++) {
    mimc.ins[i] <== inputs[i];
}
mimc.k <== key;
hash <== mimc.outs[0];
```

## 12. デバッグ技術

### ログ出力とアサーション

```circom
// ログ出力（コンパイル時）
log("Debug value:", x);

// 配列の出力
log("Array contents:");
for (var i = 0; i < n; i++) {
    log(i, "->", array[i]);
}

// アサーション（コンパイル時）
assert(x < 100);
```

### inspectフラグとカスタムアサーション

```circom
// カスタムアサーション
template AssertLessThan(max) {
    signal input in;

    // in < max を検証
    signal isValid;
    component lt = LessThan(32);
    lt.in[0] <== in;
    lt.in[1] <== max;
    isValid <== lt.out;

    // isValid == 1 であることを要求
    component eq = IsEqual();
    eq.in[0] <== isValid;
    eq.in[1] <== 1;
    eq.out === 1;
}

// 使用例
component check = AssertLessThan(100);
check.in <== value;
```

## 13. 最適化テクニック

### 計算量の削減

```circom
// 不要な計算の排除
// 悪い例（毎回計算）
for (var i = 0; i < n; i++) {
    result[i] <== input[i] * (2**10);
}

// 良い例（一度だけ計算）
var factor = 2**10;
for (var i = 0; i < n; i++) {
    result[i] <== input[i] * factor;
}
```

### ループアンロール

```circom
// ループがコンパイル時に定数回数で実行される場合
// 記述は冗長になるがベクトル化効率が上がることがある
result[0] <== inputs[0] * weights[0];
result[1] <== inputs[1] * weights[1];
result[2] <== inputs[2] * weights[2];
result[3] <== inputs[3] * weights[3];
```

### 並列化

```circom
// 独立した計算は並列化タグを使う
template parallel ExpensiveCalculation() {
    // ...
}

// 配列処理での並列化
component processors[n];
for (var i = 0; i < n; i++) {
    processors[i] = parallel ExpensiveCalculation();
}
```

## 14. 実践的なパターン

### マークルツリー検証

```circom
template VerifyMerkleProof(levels) {
    signal input leaf;
    signal input root;
    signal input pathIndices[levels];
    signal input siblings[levels];

    signal hashes[levels+1];
    hashes[0] <== leaf;

    component selectors[levels];
    component hashers[levels];

    for (var i = 0; i < levels; i++) {
        selectors[i] = Selector();
        selectors[i].in[0] <== hashes[i];
        selectors[i].in[1] <== siblings[i];
        selectors[i].s <== pathIndices[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== selectors[i].out[0];
        hashers[i].inputs[1] <== selectors[i].out[1];

        hashes[i+1] <== hashers[i].out;
    }

    // 計算されたルートが提供されたルートと一致することを確認
    root === hashes[levels];
}
```

### ECDSA署名検証

```circom
// 簡略化された例 - 実際には circomlib/ecdsa.circom を使用
template VerifyECDSA() {
    signal input pubkey[2];  // x, y座標
    signal input signature[2];  // r, s値
    signal input message;
    signal output valid;

    // ECDSAの検証ロジック
    component verifier = ECDSAVerify();
    verifier.pubkey[0] <== pubkey[0];
    verifier.pubkey[1] <== pubkey[1];
    verifier.signature[0] <== signature[0];
    verifier.signature[1] <== signature[1];
    verifier.message <== message;

    valid <== verifier.valid;
}
```

### ゼロ知識範囲証明

```circom
// 値が範囲内であることを証明（詳細を明かさずに）
template InRange(bits) {
    signal input in;
    signal input max;

    // in >= 0 の確認（暗黙的に処理される）

    // in < max の確認
    component lt = LessThan(bits);
    lt.in[0] <== in;
    lt.in[1] <== max;
    lt.out === 1;
}
```

## 15. エラー処理とベストプラクティス

### 一般的なエラーと解決策

| エラー                                                                                | 説明                                           | 解決策                                     |
| ------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------ |
| Signal assigned twice                                                                 | シグナルに複数回値を代入                       | 条件分岐内で一度だけ代入されるようにする   |
| Assignee and assigned types do not match                                              | 型の不一致                                     | 代入の型が一致するよう修正                 |
| Every component instantiation must be resolved during the constraint generation phase | コンポーネントのパラメータが実行時に決定される | パラメータをコンパイル時に決定するよう修正 |
| Constraint is not quadratic                                                           | R1CSの制約が二次でない                         | 複雑な計算を複数の制約に分解する           |

### ベストプラクティス

1. **常に制約を伴う代入（`<==`/`==>`）を使用する**

    - 例外: R1CSに表現できない演算（ビット演算など）

2. **入力シグナルには値を代入しない**

    - 入力は外部から提供されるべき

3. **テンプレートを小さく保ち再利用可能にする**

    - 大きな機能を小さなテンプレートに分割
    - 共通の機能は別テンプレートに抽出

4. **コンポーネントのすべての入力に値が割り当てられていることを確認**

    - 未割り当ての入力があるとエラーになる

5. **適切なビット幅を選択**
    - 必要以上に大きなビット幅を指定すると制約が増加

## 16. プロジェクト構造

### 典型的なプロジェクトレイアウト

```
my-zk-project/
├── circuits/
│   ├── main.circom         # メイン回路
│   ├── components/         # カスタムコンポーネント
│   │   ├── verifier.circom
│   │   └── hasher.circom
│   └── lib/                # ライブラリコード
│       └── utils.circom
├── input/                  # 入力データ
│   └── input.json
├── test/                   # テストコード
│   └── circuit.test.js
└── scripts/                # ビルド/実行スクリプト
    ├── build.sh
    └── generate_proof.js
```

### 入力ファイルの例

```json
{
    "a": "123",
    "b": "456",
    "c": ["1", "2", "3", "4", "5"]
}
```

### ビルドスクリプトの例

```bash
#!/bin/bash
# build.sh

# 回路をコンパイル
circom circuits/main.circom --r1cs --wasm --sym --c

# セットアップを実行（例: Groth16）
snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution" -v
snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v
snarkjs groth16 setup main.r1cs pot12_final.ptau main_0000.zkey
snarkjs zkey contribute main_0000.zkey main_0001.zkey --name="First contribution" -v
snarkjs zkey export verificationkey main_0001.zkey verification_key.json
```

### 証明生成スクリプトの例

```javascript
// generate_proof.js
const snarkjs = require("snarkjs");
const fs = require("fs");

async function generateProof() {
    // 入力を読み込み
    const input = JSON.parse(fs.readFileSync("input/input.json", "utf8"));

    // Witnessを計算
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        "main_js/main.wasm",
        "main_0001.zkey"
    );

    // 証明を検証
    const vKey = JSON.parse(fs.readFileSync("verification_key.json"));
    const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);

    console.log("Verification status:", verified);

    // 証明を保存
    fs.writeFileSync("proof.json", JSON.stringify(proof, null, 2));
    fs.writeFileSync("public.json", JSON.stringify(publicSignals, null, 2));

    return { proof, publicSignals, verified };
}

generateProof()
    .then(() => {
        console.log("Done!");
    })
    .catch((err) => {
        console.error(err);
    });
```
