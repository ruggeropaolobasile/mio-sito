# REORDER OS — DG Delivery POC

POC statico, mobile-first, senza backend e senza costi infrastrutturali obbligatori.

## Cosa dimostra
- catalogo filtrabile e ricercabile;
- carrello;
- nome, indirizzo, slot di consegna e note;
- generazione dell'ordine WhatsApp (nessun invio automatico);
- salvataggio locale dell'ultimo ordine;
- pulsante "Riordina l'ultimo";
- installabilita PWA di base / cache offline.

## Dati demo
Il dataset deriva dal listino pubblico DG Delivery pubblicato il 13/05/2025:
https://dgdelivery.altervista.org/prezzi-bibiteinclusa-consegna-a-domicilio/

I prezzi e la disponibilita NON vanno considerati aggiornati fino alla conferma del commerciante.

## Avvio locale
Serve un web server statico (per fetch JSON e service worker):

```bash
python -m http.server 8080
```

Poi aprire `http://localhost:8080`.

## V0 -> SaaS
Per il prodotto reale, sostituire localStorage con Supabase/Postgres e aggiungere tenant, customers, orders, order_items, delivery_slots e merchant_users. Non serve integrare pagamenti nella prima release.
