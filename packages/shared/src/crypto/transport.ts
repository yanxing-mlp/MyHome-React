/**
 * 口令的**传输段**加解密（v11）：浏览器里加密 → 服务端业务入口解密；反向只有密码本 reveal
 * 一处（服务端加密返回，这里解密后展示给本人）。
 *
 * 与服务端 `com.familyhome.common.crypto.TransportCipher` **逐字节对齐**，四个参数任一改动都必须同步另一侧：
 * - PBKDF2-HMAC-SHA256，**10 万轮**，盐串自身既当口令又当盐，派生 **256 bit**
 * - AES-**GCM**，**12 字节随机 IV**，**128 bit** 认证标签
 * - 线上编码：`base64(IV || 密文 || 标签)`（Web Crypto 的 `encrypt` 返回值本来就是"密文||标签"，直接拼）
 *
 * 三件事要说在前面，将来觉得这里"可以简化"的人先读完：
 *
 * 1. **它防的是链路，不是端**。这一串盐最终会被打进前端产物，任何能打开 DevTools 的人都拿得到，
 *    所以它挡的是"http 明文请求在家庭局域网里被顺手抓包"和"口令落进 nginx access log"，
 *    **不是** TLS 的替代品。真要做链路加密，请在方案 §8.3 那份 nginx 上配 https。
 * 2. **它不碰存储层**。服务端解出明文之后，走的仍是原来那套：登录口令进
 *    `UserPasswordManager`（PBKDF2 20 万轮，单向哈希），密码本口令进 `VaultCipherManager`
 *    （服务端另一把 key 的 AES-256-GCM）。库里的两列格式、`select = false` 那些护栏一条都没变。
 *    两把钥匙、两段链路，别混着用。
 * 3. **它要求 secure context**。`crypto.subtle` 只在 https 或 localhost 下存在，用 http 从一个
 *    局域网 IP 打开（比如手机连 `http://192.168.x.x:5174`）就是 `undefined`。这不是能靠 fallback
 *    绕过去的——Web Crypto 没有降级实现。所以这里**直接抛中文错误**，而不是留一句
 *    `Cannot read properties of undefined` 让下一个人从堆栈里猜。生产部署因此**必须上 https**，
 *    这一条写进方案 §8.3 与 §10。
 *
 * 盐从哪来：默认值是那一串仓库里公开的 dev 盐（与服务端 `application-dev.yml` 的默认值必须完全相同）；
 * 生产构建用 `VITE_FH_TRANSPORT_CRYPTO_SALT` 覆盖，且必须与服务端 `FH_TRANSPORT_CRYPTO_SALT` 配对。
 * 两边不一致的症状是"所有人登录都报口令无法解密"，不是"某些人"，所以很好认。
 */

/** 与服务端 `TransportCipher.KDF_ITERATIONS` 必须一致。 */
const TRANSPORT_KDF_ITERATIONS = 100_000;
/** 与服务端 `TransportCipher.KEY_LENGTH_BITS` 必须一致。 */
const TRANSPORT_KEY_LENGTH_BITS = 256;
/** 与服务端 `TransportCipher.IV_LENGTH_BYTES` 必须一致。 */
const TRANSPORT_IV_LENGTH_BYTES = 12;

/**
 * dev 盐，与服务端 `application-dev.yml` 里那个默认值逐字符相同。
 *
 * 它进得了仓库是因为它**只**在 dev 有用：dev 那套配置里它本来也是明文写着给本地起服务用的。
 * 生产必须用 `VITE_FH_TRANSPORT_CRYPTO_SALT` 覆盖，否则等于所有人共用一把公开钥匙，
 * 这一层加密就只剩心理作用。
 */
const DEV_TRANSPORT_SALT = 'fh-dev-7184bf06e1a8eaf27d22bd216a3c42f5';

/** 盐短于这个长度时，暴力枚举盐 ≈ 暴力枚举口令（服务端 `MIN_SALT_CHARS` 同值）。 */
const MIN_SALT_CHARS = 16;

/**
 * 读取构建期注入的盐。
 *
 * 这里没有用 `import.meta.env.VITE_X` 的直写形式，是因为 `packages/shared` 的 tsconfig 里
 * `types` 只有 `react`，没有 `vite/client`——直写会是个类型错误，而为了一行取值给共享包加个
 * vite 类型依赖不值当。所以做一次显式收窄，取不到就退回 dev 盐。
 */
function resolveTransportSalt(): string {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    return env?.VITE_FH_TRANSPORT_CRYPTO_SALT?.trim() || DEV_TRANSPORT_SALT;
}

function requireSubtle(): SubtleCrypto {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) {
        throw new Error(
            '当前环境不支持 Web Crypto（crypto.subtle 不可用），口令无法加密。' +
                '请通过 https 或 localhost 访问本页面。'
        );
    }
    return subtle;
}

/** 派生密钥的 Promise 缓存：PBKDF2 十万轮虽只要几毫秒，但没必要每次提交口令都重跑一遍。 */
let derivedKey: Promise<CryptoKey> | null = null;

function getTransportKey(): Promise<CryptoKey> {
    if (!derivedKey) {
        derivedKey = deriveTransportKey();
    }
    return derivedKey;
}

async function deriveTransportKey(): Promise<CryptoKey> {
    const subtle = requireSubtle();
    const salt = resolveTransportSalt();
    if (salt.length < MIN_SALT_CHARS) {
        throw new Error(`口令传输盐至少 ${MIN_SALT_CHARS} 个字符（当前 ${salt.length}）`);
    }
    if (salt.trim() !== salt) {
        throw new Error('口令传输盐两端都会先 trim，配置里请不要带首尾空格');
    }
    // 与服务端 deriveKey 的输入一致：盐串的 UTF-8 字节既当 PBKDF2 的口令材料，也当它的 salt。
    const saltBytes = new TextEncoder().encode(salt);
    const baseKey = await subtle.importKey('raw', saltBytes, 'PBKDF2', false, ['deriveBits']);
    const bits = await subtle.deriveBits(
        { name: 'PBKDF2', salt: saltBytes, iterations: TRANSPORT_KDF_ITERATIONS, hash: 'SHA-256' },
        baseKey,
        TRANSPORT_KEY_LENGTH_BITS
    );
    return subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}

/**
 * 返回类型显式写成 `Uint8Array<ArrayBuffer>`：TS 5.9 的 `BufferSource` 只认挂在普通
 * `ArrayBuffer` 上的视图（`ArrayBufferLike` 还包含 `SharedArrayBuffer`），少写这一个泛型参数
 * 下面两处 `subarray` 就当参数类型不合法。
 */
function fromBase64(text: string): Uint8Array<ArrayBuffer> {
    const binary = atob(text.trim());
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * 把明文口令加密成送进请求体的那一串。
 *
 * 明文按 UTF-8 编码，与服务端 `new String(plain, UTF_8)` 对称。
 * 口令本身不做 trim（`123456 ` 与 `123456` 是两个口令，服务端那侧也一样），
 * 但空串直接拒绝：那是一句"请输入密码"，不该变成一次网络请求。
 */
export async function encryptPassword(plain: string): Promise<string> {
    if (!plain) {
        throw new Error('请输入密码');
    }
    const subtle = requireSubtle();
    const key = await getTransportKey();
    const iv = new Uint8Array(TRANSPORT_IV_LENGTH_BYTES);
    crypto.getRandomValues(iv);
    const cipherTail = new Uint8Array(
        await subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain))
    );
    const packed = new Uint8Array(iv.length + cipherTail.length);
    packed.set(iv, 0);
    packed.set(cipherTail, iv.length);
    return toBase64(packed);
}

/**
 * 解开服务端下发的口令（目前只有密码本 reveal 一个调用方）。
 *
 * 解不开基本都是"前端这份盐与服务端那份不一致"，错误里就照这个说，不要报成"密码错误"——
 * 用户在这一屏没有输过任何东西。
 */
export async function decryptPassword(cipherText: string): Promise<string> {
    const subtle = requireSubtle();
    if (!cipherText) {
        throw new Error('该条目没有口令');
    }
    const packed = fromBase64(cipherText);
    if (packed.length <= TRANSPORT_IV_LENGTH_BYTES) {
        throw new Error('口令无法解密，请刷新页面后重试（前后端加密参数不一致）');
    }
    const key = await getTransportKey();
    try {
        const plain = await subtle.decrypt(
            { name: 'AES-GCM', iv: packed.subarray(0, TRANSPORT_IV_LENGTH_BYTES) },
            key,
            packed.subarray(TRANSPORT_IV_LENGTH_BYTES)
        );
        return new TextDecoder().decode(plain);
    } catch {
        // GCM 认证失败：要么盐不一致，要么这串东西根本不是服务端加密的
        throw new Error('口令无法解密，请刷新页面后重试（前后端加密参数不一致）');
    }
}
