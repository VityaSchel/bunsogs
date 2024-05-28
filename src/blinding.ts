// Huge thanks to li0ard for this code
// CREDIT: https://github.com/theinfinityway/session_id/

/* eslint-disable prefer-const */

import { cloneDeep, isEqual } from 'lodash'
import sodium, { crypto_core_ed25519_scalar_reduce } from 'libsodium-wrappers-sumo'

function gf(init?: number[]) {
  let i, r = new Float64Array(16)
  if (init) for (i = 0; i < init.length; i++) r[i] = init[i]
  return r
}

function unpack25519(o: Float64Array, n: Uint8Array) {
  let i
  for (i = 0; i < 16; i++) o[i] = n[2 * i] + (n[2 * i + 1] << 8)
  o[15] &= 0x7fff
}

function A(o: Float64Array, a: Float64Array, b: Float64Array) {
  for (let i = 0; i < 16; i++) o[i] = a[i] + b[i]
}

function Z(o: Float64Array, a: Float64Array, b: Float64Array) {
  for (let i = 0; i < 16; i++) o[i] = a[i] - b[i]
}

function S(o: Float64Array, a: Float64Array) {
  M(o, a, a)
}

function inv25519(o: Float64Array, i: Float64Array) {
  const c = gf()
  let a
  for (a = 0; a < 16; a++) c[a] = i[a]
  for (a = 253; a >= 0; a--) {
    S(c, c)
    if (a !== 2 && a !== 4) M(c, c, i)
  }
  for (a = 0; a < 16; a++) o[a] = c[a]
}

function M(o: Float64Array, a: Float64Array, b: Float64Array) {
  let v,
    c,
    t0 = 0,
    t1 = 0,
    t2 = 0,
    t3 = 0,
    t4 = 0,
    t5 = 0,
    t6 = 0,
    t7 = 0,
    t8 = 0,
    t9 = 0,
    t10 = 0,
    t11 = 0,
    t12 = 0,
    t13 = 0,
    t14 = 0,
    t15 = 0,
    t16 = 0,
    t17 = 0,
    t18 = 0,
    t19 = 0,
    t20 = 0,
    t21 = 0,
    t22 = 0,
    t23 = 0,
    t24 = 0,
    t25 = 0,
    t26 = 0,
    t27 = 0,
    t28 = 0,
    t29 = 0,
    t30 = 0,
    b0 = b[0],
    b1 = b[1],
    b2 = b[2],
    b3 = b[3],
    b4 = b[4],
    b5 = b[5],
    b6 = b[6],
    b7 = b[7],
    b8 = b[8],
    b9 = b[9],
    b10 = b[10],
    b11 = b[11],
    b12 = b[12],
    b13 = b[13],
    b14 = b[14],
    b15 = b[15]

  v = a[0]
  t0 += v * b0
  t1 += v * b1
  t2 += v * b2
  t3 += v * b3
  t4 += v * b4
  t5 += v * b5
  t6 += v * b6
  t7 += v * b7
  t8 += v * b8
  t9 += v * b9
  t10 += v * b10
  t11 += v * b11
  t12 += v * b12
  t13 += v * b13
  t14 += v * b14
  t15 += v * b15
  v = a[1]
  t1 += v * b0
  t2 += v * b1
  t3 += v * b2
  t4 += v * b3
  t5 += v * b4
  t6 += v * b5
  t7 += v * b6
  t8 += v * b7
  t9 += v * b8
  t10 += v * b9
  t11 += v * b10
  t12 += v * b11
  t13 += v * b12
  t14 += v * b13
  t15 += v * b14
  t16 += v * b15
  v = a[2]
  t2 += v * b0
  t3 += v * b1
  t4 += v * b2
  t5 += v * b3
  t6 += v * b4
  t7 += v * b5
  t8 += v * b6
  t9 += v * b7
  t10 += v * b8
  t11 += v * b9
  t12 += v * b10
  t13 += v * b11
  t14 += v * b12
  t15 += v * b13
  t16 += v * b14
  t17 += v * b15
  v = a[3]
  t3 += v * b0
  t4 += v * b1
  t5 += v * b2
  t6 += v * b3
  t7 += v * b4
  t8 += v * b5
  t9 += v * b6
  t10 += v * b7
  t11 += v * b8
  t12 += v * b9
  t13 += v * b10
  t14 += v * b11
  t15 += v * b12
  t16 += v * b13
  t17 += v * b14
  t18 += v * b15
  v = a[4]
  t4 += v * b0
  t5 += v * b1
  t6 += v * b2
  t7 += v * b3
  t8 += v * b4
  t9 += v * b5
  t10 += v * b6
  t11 += v * b7
  t12 += v * b8
  t13 += v * b9
  t14 += v * b10
  t15 += v * b11
  t16 += v * b12
  t17 += v * b13
  t18 += v * b14
  t19 += v * b15
  v = a[5]
  t5 += v * b0
  t6 += v * b1
  t7 += v * b2
  t8 += v * b3
  t9 += v * b4
  t10 += v * b5
  t11 += v * b6
  t12 += v * b7
  t13 += v * b8
  t14 += v * b9
  t15 += v * b10
  t16 += v * b11
  t17 += v * b12
  t18 += v * b13
  t19 += v * b14
  t20 += v * b15
  v = a[6]
  t6 += v * b0
  t7 += v * b1
  t8 += v * b2
  t9 += v * b3
  t10 += v * b4
  t11 += v * b5
  t12 += v * b6
  t13 += v * b7
  t14 += v * b8
  t15 += v * b9
  t16 += v * b10
  t17 += v * b11
  t18 += v * b12
  t19 += v * b13
  t20 += v * b14
  t21 += v * b15
  v = a[7]
  t7 += v * b0
  t8 += v * b1
  t9 += v * b2
  t10 += v * b3
  t11 += v * b4
  t12 += v * b5
  t13 += v * b6
  t14 += v * b7
  t15 += v * b8
  t16 += v * b9
  t17 += v * b10
  t18 += v * b11
  t19 += v * b12
  t20 += v * b13
  t21 += v * b14
  t22 += v * b15
  v = a[8]
  t8 += v * b0
  t9 += v * b1
  t10 += v * b2
  t11 += v * b3
  t12 += v * b4
  t13 += v * b5
  t14 += v * b6
  t15 += v * b7
  t16 += v * b8
  t17 += v * b9
  t18 += v * b10
  t19 += v * b11
  t20 += v * b12
  t21 += v * b13
  t22 += v * b14
  t23 += v * b15
  v = a[9]
  t9 += v * b0
  t10 += v * b1
  t11 += v * b2
  t12 += v * b3
  t13 += v * b4
  t14 += v * b5
  t15 += v * b6
  t16 += v * b7
  t17 += v * b8
  t18 += v * b9
  t19 += v * b10
  t20 += v * b11
  t21 += v * b12
  t22 += v * b13
  t23 += v * b14
  t24 += v * b15
  v = a[10]
  t10 += v * b0
  t11 += v * b1
  t12 += v * b2
  t13 += v * b3
  t14 += v * b4
  t15 += v * b5
  t16 += v * b6
  t17 += v * b7
  t18 += v * b8
  t19 += v * b9
  t20 += v * b10
  t21 += v * b11
  t22 += v * b12
  t23 += v * b13
  t24 += v * b14
  t25 += v * b15
  v = a[11]
  t11 += v * b0
  t12 += v * b1
  t13 += v * b2
  t14 += v * b3
  t15 += v * b4
  t16 += v * b5
  t17 += v * b6
  t18 += v * b7
  t19 += v * b8
  t20 += v * b9
  t21 += v * b10
  t22 += v * b11
  t23 += v * b12
  t24 += v * b13
  t25 += v * b14
  t26 += v * b15
  v = a[12]
  t12 += v * b0
  t13 += v * b1
  t14 += v * b2
  t15 += v * b3
  t16 += v * b4
  t17 += v * b5
  t18 += v * b6
  t19 += v * b7
  t20 += v * b8
  t21 += v * b9
  t22 += v * b10
  t23 += v * b11
  t24 += v * b12
  t25 += v * b13
  t26 += v * b14
  t27 += v * b15
  v = a[13]
  t13 += v * b0
  t14 += v * b1
  t15 += v * b2
  t16 += v * b3
  t17 += v * b4
  t18 += v * b5
  t19 += v * b6
  t20 += v * b7
  t21 += v * b8
  t22 += v * b9
  t23 += v * b10
  t24 += v * b11
  t25 += v * b12
  t26 += v * b13
  t27 += v * b14
  t28 += v * b15
  v = a[14]
  t14 += v * b0
  t15 += v * b1
  t16 += v * b2
  t17 += v * b3
  t18 += v * b4
  t19 += v * b5
  t20 += v * b6
  t21 += v * b7
  t22 += v * b8
  t23 += v * b9
  t24 += v * b10
  t25 += v * b11
  t26 += v * b12
  t27 += v * b13
  t28 += v * b14
  t29 += v * b15
  v = a[15]
  t15 += v * b0
  t16 += v * b1
  t17 += v * b2
  t18 += v * b3
  t19 += v * b4
  t20 += v * b5
  t21 += v * b6
  t22 += v * b7
  t23 += v * b8
  t24 += v * b9
  t25 += v * b10
  t26 += v * b11
  t27 += v * b12
  t28 += v * b13
  t29 += v * b14
  t30 += v * b15

  t0 += 38 * t16
  t1 += 38 * t17
  t2 += 38 * t18
  t3 += 38 * t19
  t4 += 38 * t20
  t5 += 38 * t21
  t6 += 38 * t22
  t7 += 38 * t23
  t8 += 38 * t24
  t9 += 38 * t25
  t10 += 38 * t26
  t11 += 38 * t27
  t12 += 38 * t28
  t13 += 38 * t29
  t14 += 38 * t30
  // t15 left as is

  // first car
  c = 1
  v = t0 + c + 65535
  c = Math.floor(v / 65536)
  t0 = v - c * 65536
  v = t1 + c + 65535
  c = Math.floor(v / 65536)
  t1 = v - c * 65536
  v = t2 + c + 65535
  c = Math.floor(v / 65536)
  t2 = v - c * 65536
  v = t3 + c + 65535
  c = Math.floor(v / 65536)
  t3 = v - c * 65536
  v = t4 + c + 65535
  c = Math.floor(v / 65536)
  t4 = v - c * 65536
  v = t5 + c + 65535
  c = Math.floor(v / 65536)
  t5 = v - c * 65536
  v = t6 + c + 65535
  c = Math.floor(v / 65536)
  t6 = v - c * 65536
  v = t7 + c + 65535
  c = Math.floor(v / 65536)
  t7 = v - c * 65536
  v = t8 + c + 65535
  c = Math.floor(v / 65536)
  t8 = v - c * 65536
  v = t9 + c + 65535
  c = Math.floor(v / 65536)
  t9 = v - c * 65536
  v = t10 + c + 65535
  c = Math.floor(v / 65536)
  t10 = v - c * 65536
  v = t11 + c + 65535
  c = Math.floor(v / 65536)
  t11 = v - c * 65536
  v = t12 + c + 65535
  c = Math.floor(v / 65536)
  t12 = v - c * 65536
  v = t13 + c + 65535
  c = Math.floor(v / 65536)
  t13 = v - c * 65536
  v = t14 + c + 65535
  c = Math.floor(v / 65536)
  t14 = v - c * 65536
  v = t15 + c + 65535
  c = Math.floor(v / 65536)
  t15 = v - c * 65536
  t0 += c - 1 + 37 * (c - 1)

  // second car
  c = 1
  v = t0 + c + 65535
  c = Math.floor(v / 65536)
  t0 = v - c * 65536
  v = t1 + c + 65535
  c = Math.floor(v / 65536)
  t1 = v - c * 65536
  v = t2 + c + 65535
  c = Math.floor(v / 65536)
  t2 = v - c * 65536
  v = t3 + c + 65535
  c = Math.floor(v / 65536)
  t3 = v - c * 65536
  v = t4 + c + 65535
  c = Math.floor(v / 65536)
  t4 = v - c * 65536
  v = t5 + c + 65535
  c = Math.floor(v / 65536)
  t5 = v - c * 65536
  v = t6 + c + 65535
  c = Math.floor(v / 65536)
  t6 = v - c * 65536
  v = t7 + c + 65535
  c = Math.floor(v / 65536)
  t7 = v - c * 65536
  v = t8 + c + 65535
  c = Math.floor(v / 65536)
  t8 = v - c * 65536
  v = t9 + c + 65535
  c = Math.floor(v / 65536)
  t9 = v - c * 65536
  v = t10 + c + 65535
  c = Math.floor(v / 65536)
  t10 = v - c * 65536
  v = t11 + c + 65535
  c = Math.floor(v / 65536)
  t11 = v - c * 65536
  v = t12 + c + 65535
  c = Math.floor(v / 65536)
  t12 = v - c * 65536
  v = t13 + c + 65535
  c = Math.floor(v / 65536)
  t13 = v - c * 65536
  v = t14 + c + 65535
  c = Math.floor(v / 65536)
  t14 = v - c * 65536
  v = t15 + c + 65535
  c = Math.floor(v / 65536)
  t15 = v - c * 65536
  t0 += c - 1 + 37 * (c - 1)

  o[0] = t0
  o[1] = t1
  o[2] = t2
  o[3] = t3
  o[4] = t4
  o[5] = t5
  o[6] = t6
  o[7] = t7
  o[8] = t8
  o[9] = t9
  o[10] = t10
  o[11] = t11
  o[12] = t12
  o[13] = t13
  o[14] = t14
  o[15] = t15
}

function car25519(o: Float64Array) {
  let i,
    v,
    c = 1
  for (i = 0; i < 16; i++) {
    v = o[i] + c + 65535
    c = Math.floor(v / 65536)
    o[i] = v - c * 65536
  }
  o[0] += c - 1 + 37 * (c - 1)
}

function sel25519(p: Float64Array, q: Float64Array, b: number) {
  let t,
    c = ~(b - 1)
  for (let i = 0; i < 16; i++) {
    t = c & (p[i] ^ q[i])
    p[i] ^= t
    q[i] ^= t
  }
}

function pack25519(o: Uint8Array, n: Float64Array) {
  let i, j, b
  const m = gf(),
    t = gf()
  for (i = 0; i < 16; i++) t[i] = n[i]
  car25519(t)
  car25519(t)
  car25519(t)
  for (j = 0; j < 2; j++) {
    m[0] = t[0] - 0xffed
    for (i = 1; i < 15; i++) {
      m[i] = t[i] - 0xffff - ((m[i - 1] >> 16) & 1)
      m[i - 1] &= 0xffff
    }
    m[15] = t[15] - 0x7fff - ((m[14] >> 16) & 1)
    b = (m[15] >> 16) & 1
    m[14] &= 0xffff
    sel25519(t, m, 1 - b)
  }
  for (i = 0; i < 16; i++) {
    o[2 * i] = t[i] & 0xff
    o[2 * i + 1] = t[i] >> 8
  }
}

export function crypto_sign_curve25519_pk_to_ed25519(pk: Uint8Array) {
  return convertPublicKey(pk)
}

// Converts Curve25519 public key back to Ed25519 public key.
// edwardsY = (montgomeryX - 1) / (montgomeryX + 1)
function convertPublicKey(pk: Uint8Array) {
  const z = new Uint8Array(32),
    x = gf(),
    a = gf(),
    b = gf(),
    gf1 = gf([1])

  unpack25519(x, pk)

  A(a, x, gf1)
  Z(b, x, gf1)
  inv25519(a, a)
  M(a, a, b)

  pack25519(z, a)
  return z
}

export const convertToEd25519Key = (key: string): string => {
  const inbin = sodium.from_hex(key)
  const xEd25519Key = crypto_sign_curve25519_pk_to_ed25519(inbin)
  return sodium.to_hex(xEd25519Key)
}

export const convertToX25519Key = (key: string): string => {
  const inbin = sodium.from_hex(key)
  const xEd25519Key = sodium.crypto_sign_ed25519_pk_to_curve25519(inbin)
  return sodium.to_hex(xEd25519Key)
}

function combineKeys(lhsKeyBytes: Uint8Array, rhsKeyBytes: Uint8Array) {
  return sodium.crypto_scalarmult_ed25519_noclamp(lhsKeyBytes, rhsKeyBytes)
}

const generateBlindingFactor = (serverPk: string) => {
  const hexServerPk = sodium.from_hex(serverPk)
  const serverPkHash = sodium.crypto_generichash(64, hexServerPk)
  return sodium.crypto_core_ed25519_scalar_reduce(serverPkHash)
}

export const generateKAs = (sessionId: string, serverPk: string): Uint8Array[] => {
  const sessionIdNoPrefix = sessionId.substring(2)
  const kBytes = generateBlindingFactor(serverPk)
  const xEd25519Key = sodium.from_hex(convertToEd25519Key(sessionIdNoPrefix))
  const kA = combineKeys(kBytes, xEd25519Key)
  const kA2 = cloneDeep(kA)
  kA2[31] = kA[31] ^ 0b1000_0000

  return [kA, kA2]
}

export const generateBlindedIds = (sessionId: string, serverPk: string): string[] => {
  const [kA, kA2] = generateKAs(sessionId, serverPk)
  return ['15' + sodium.to_hex(kA), '15' + sodium.to_hex(kA2)]
}

export const generateBlindedId = (sessionId: string, serverPk: string): string => {
  const [kA, kA2] = generateKAs(sessionId, serverPk)

  if (!(kA[31] & 0x80)) {
    return '15' + sodium.to_hex(kA2)
  }
  
  return '15' + sodium.to_hex(kA)
}