import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

export default {
    input: 'src/payment-sdk.js',
    output: [
        {
            file: 'dist/payment-sdk.umd.js',
            format: 'umd',
            name: 'PaymentCheckout',
            exports: 'named',
            sourcemap: true
        },
        {
            file: 'dist/payment-sdk.esm.js',
            format: 'esm',
            sourcemap: true
        }
    ],
    plugins: [
        resolve(),
        commonjs(),
        terser()
    ]
};