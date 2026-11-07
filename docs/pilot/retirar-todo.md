# Cómo retirar todo tu dinero de Sozu

Tu dinero es tuyo. Con **Retirar todo** podés mandar todo tu saldo en USDC a otra billetera o a un exchange, cuando quieras. Sozu no puede frenar ni cambiar ese envío: lo confirmás vos con tu passkey (tu huella o tu cara).

## Antes de empezar

- Necesitás tu teléfono con la app de Sozu y tu passkey.
- Necesitás una **dirección de destino en la red Stellar** que acepte **USDC**:
  - Una billetera Stellar propia (por ejemplo Lobstr): la dirección empieza con **G**.
  - Un exchange: buscá "Depositar USDC" y elegí la red **Stellar** (no otra red). Te va a dar una dirección que empieza con **G** y, muchas veces, un **memo**.
- Si es la primera vez que usás ese exchange o esa billetera, **probá primero con un monto chico** desde "Enviar", y recién después usá "Retirar todo".

## Paso a paso

1. Abrí Sozu y tocá **Retirar todo** (abajo de los botones Pagar y Depositar).
2. **Pegá la dirección** de destino completa. Copiala con el botón "copiar" del exchange o billetera; no la escribas a mano.
3. Si tu exchange te dio un **memo**, pegalo en **Memo**. Si no te dio memo, dejalo vacío.
4. Tocá **Revisar**. Sozu verifica que la cuenta exista y acepte USDC.
5. En la pantalla de confirmación, revisá con calma:
   - **El monto**: es todo tu saldo, con todos los decimales.
   - **La dirección completa**: está separada en grupos de 4 letras. Comparala grupo por grupo con la de tu exchange o billetera. Si un solo grupo no coincide, **no confirmes**.
   - **El memo**, si pusiste uno.
6. Tocá **Confirmar con passkey** y usá tu huella o tu cara.
7. Esperá unos segundos. Vas a ver el **comprobante** con el **hash** (un código largo). Ese código es la prueba del envío: guardalo o sacale una captura.

## Sobre el memo de los exchanges (importante)

Tu billetera Sozu es una **billetera inteligente**. Por cómo funciona la red Stellar, este tipo de billetera **no puede poner un memo de texto** en el envío.

- **Memo de números** (por ejemplo `123456789`): Sozu lo manda dentro de la dirección (una dirección especial que empieza con **M** y lleva el memo adentro). Es la forma oficial que recomienda Stellar.
- **Memo con letras**, o que empieza con 0: **no se puede enviar**. La app te va a avisar. Pedile al exchange un memo numérico o usá otra billetera.
- Si el exchange te da directamente una dirección que empieza con **M**, pegala tal cual y dejá el memo vacío.

**Atención:** algunos exchanges todavía no acreditan automáticamente los envíos que vienen de billeteras inteligentes, aunque el envío haya salido bien. Por eso: **probá primero con poco** y, si tenés dudas, preguntale al soporte del exchange si acepta "depósitos USDC por contrato Soroban (SAC) con dirección M / muxed".

## Si algo sale mal

- **"Esa cuenta todavía no acepta USDC"**: la cuenta de destino tiene que agregar USDC (trustline) primero. En un exchange, revisá que sea la dirección de **USDC en Stellar**.
- **"Esa cuenta todavía no existe en Stellar"**: la billetera de destino tiene que estar activada con un poco de XLM antes.
- **"Ese memo tiene letras o empieza con 0"**: mirá la sección del memo de arriba.
- **"Tu saldo cambió"**: entró o salió dinero mientras revisabas. Mirá el nuevo monto y confirmá de nuevo.
- **"No se pudo confirmar con la passkey"**: no se envió nada. Cerrá otras ventanas de passkey y probá otra vez.
- **"El envío puede seguir en camino"**: **no lo repitas**. Esperá dos minutos y mirá tu saldo. Si bajó a cero, el envío salió.
- **Tocaste confirmar dos veces**: tranquila, Sozu manda el dinero **una sola vez**.
- **El envío salió pero el exchange no lo muestra**: buscá el hash del comprobante en [stellar.expert](https://stellar.expert) para ver que llegó a la dirección correcta y mandale ese hash al soporte del exchange.

¿Seguís con dudas? Escribile a tu referente de Mujeres 2000 o al equipo de Sozu y mandá una captura de la pantalla (nunca compartas tu passkey ni códigos de recuperación).
