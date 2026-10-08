# Delta

Juego web gratuito sobre el Delta del Paraná en Tigre, pensado para celulares. Usa BabylonJS, TypeScript, Vite y PWA.

[Jugá en el navegador](https://matiasnamendola.github.io/delta/).

## Desarrollo local

En un checkout del repo, con Node.js y npm instalados (macOS/zsh o Linux/bash):

```sh
npm ci
npm run bake          # world.json -> layout.bin (lo hacen también dev y build)
npm run dev           # vite (en la nube se usó el puerto 4102)
npx vitest run
npx tsc --noEmit
```

La [documentación](docs/README.md) reúne producto, investigaciones y decisiones. El [traspaso](docs/TRASPASO.md) explica las reglas de trabajo y las fuentes.

El código está bajo [Apache License 2.0](LICENSE), copyright 2026 Matías Nahuel Amendola. Los datos y assets de terceros conservan sus licencias: ver [créditos](CREDITS.md) y [NOTICE](NOTICE).

Se aceptan aportes de datos del mapa, código, fotos y modelos 3D. Consultá la [guía de contribuciones](CONTRIBUTING.md).
