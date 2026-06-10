import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
  // 💡 아래 설정을 배열의 마지막에 추가합니다.
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // any 타입 허용
      'react-hooks/exhaustive-deps': 'off', // 💡 의존성 배열 경고 끄기
    },
  },
])

export default eslintConfig
