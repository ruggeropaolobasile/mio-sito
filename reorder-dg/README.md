# REORDER OS — DG Delivery POC

POC statico, mobile-first, senza backend e senza costi infrastrutturali obbligatori.

## Stato
Versione demo v0.2.

## Cosa dimostra
- catalogo filtrabile e ricercabile;
- carrello;
- nome e indirizzo;
- piano dell'abitazione;
- presenza/assenza ascensore;
- richiesta di consegna al portone oppure al piano;
- avviso automatico per consegne impegnative (es. piano alto senza ascensore);
- slot di consegna e note;
- generazione della richiesta WhatsApp;
- salvataggio locale dell'ultimo ordine;
- pulsante "Riordina l'ultimo";
- PWA con cache aggiornata automaticamente.

## Principio operativo
La V0 non decide supplementi o rifiuti. Raccoglie prima dell'invio i dati che DG deve conoscere per valutare la consegna.

Esempio:

```text
4 casse acqua
Via ...
3° piano
senza ascensore
consegna al piano richiesta
```

DG conferma poi disponibilita, prezzo finale e fattibilita della consegna.

## Dati demo
Il dataset deriva dal listino storico pubblico DG Delivery pubblicato il 13/05/2025:
https://dgdelivery.altervista.org/prezzi-bibiteinclusa-consegna-a-domicilio/

I prezzi e la disponibilita NON sono presentati come listino attuale finche DG Delivery non li conferma.

## Avvio locale
Serve un web server statico:

```bash
python -m http.server 8080
```

Poi aprire `http://localhost:8080`.

## V0 -> SaaS
Per il prodotto reale, sostituire localStorage con Supabase/Postgres e aggiungere tenant, customers, orders, order_items, delivery_slots, delivery_constraints e merchant_users.

Non serve integrare pagamenti nella prima release.
