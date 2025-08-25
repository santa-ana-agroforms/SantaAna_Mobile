#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera nombres de llaves para SecureStore (Expo) + secretos/tokens URL-safe.
- Keys válidas: alfanumérico + . - _  (compatible con SecureStore)
- Tokens seguros con 'secrets' (CSPRNG). Por defecto 256 bits.

Ejemplos:
  python gen_secure_keys.py --ts-out src/api/secure-keys.ts
  python gen_secure_keys.py --ts-out src/api/secure-keys.ts --env-out .env.local --random-names --prefix SANTAANA_
"""
import argparse, secrets, string, json, pathlib, sys
from dataclasses import dataclass, asdict
from typing import Dict

ALLOWED = string.ascii_letters + string.digits + "._-"

def gen_key_name(base: str, length: int = 10) -> str:
    suf = "".join(secrets.choice(ALLOWED) for _ in range(length))
    return f"{base}{suf}"

def token_urlsafe_bits(bits: int = 256) -> str:
    if bits % 8 != 0:
        raise ValueError("bits debe ser múltiplo de 8")
    return secrets.token_urlsafe(bits // 8)

@dataclass
class KeySet:
    API_BASE_KEY: str
    ACCESS_KEY: str
    REFRESH_KEY: str
    ACCESS_SECRET: str
    REFRESH_SECRET: str
    QR_MAGIC_CODE: str  # útil si haces login mágico por QR

def make_set(prefix: str, random_names: bool, bits: int) -> KeySet:
    if random_names:
        api = gen_key_name(f"{prefix}API_BASE_", 12)
        acc = gen_key_name(f"{prefix}ACCESS_", 12)
        ref = gen_key_name(f"{prefix}REFRESH_", 12)
    else:
        api = f"{prefix}API_BASE_URL"
        acc = f"{prefix}ACCESS_TOKEN"
        ref = f"{prefix}REFRESH_TOKEN"
    return KeySet(
        API_BASE_KEY=api,
        ACCESS_KEY=acc,
        REFRESH_KEY=ref,
        ACCESS_SECRET=token_urlsafe_bits(bits),
        REFRESH_SECRET=token_urlsafe_bits(bits),
        QR_MAGIC_CODE=token_urlsafe_bits(bits // 2),
    )

def write_ts(path: pathlib.Path, ks: KeySet):
    path.parent.mkdir(parents=True, exist_ok=True)
    code = f"""// AUTO-GENERADO por gen_secure_keys.py
// Llaves (key names) para Expo SecureStore + secretos auxiliares
export const API_BASE_KEY = '{ks.API_BASE_KEY}';
export const ACCESS_KEY   = '{ks.ACCESS_KEY}';
export const REFRESH_KEY  = '{ks.REFRESH_KEY}';

// Secretos útiles en el cliente (p.ej. seed/nonce/qr-magic). NO son tus JWT.
export const ACCESS_SECRET  = '{ks.ACCESS_SECRET}';
export const REFRESH_SECRET = '{ks.REFRESH_SECRET}';
export const QR_MAGIC_CODE  = '{ks.QR_MAGIC_CODE}';
"""
    path.write_text(code, encoding="utf-8")

def to_env(d: Dict[str, str]) -> str:
    return "\n".join(f"{k}={v}" for k, v in d.items())

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--random-names", action="store_true", help="Generar nombres de llaves aleatorios")
    ap.add_argument("--prefix", type=str, default="", help="Prefijo para las llaves (ej. SANTAANA_)")
    ap.add_argument("--bits", type=int, default=256, help="Entropía de los tokens (múltiplo de 8)")
    ap.add_argument("--ts-out", type=str, help="Ruta para escribir un TS con exports")
    ap.add_argument("--env-out", type=str, help="Ruta para escribir .env con los valores")
    args = ap.parse_args()

    ks = make_set(args.prefix, args.random_names, args.bits)

    if args.ts_out:
        write_ts(pathlib.Path(args.ts_out), ks)
        print(f"[OK] TS escrito en {args.ts_out}")

    if args.env_out:
        env_map = {k: str(v) for k, v in asdict(ks).items()}
        pathlib.Path(args.env_out).write_text(to_env(env_map), encoding="utf-8")
        print(f"[OK] .env escrito en {args.env_out}")

    if not args.ts_out and not args.env_out:
        print(json.dumps(asdict(ks), indent=2))

if __name__ == "__main__":
    main()
