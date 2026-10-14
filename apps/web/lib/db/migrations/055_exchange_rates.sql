-- TCMB indicative rates, one row per bulletin and currency, per 1 foreign unit. Shared by every
-- firm (public data). A bulletin dated D (published 15:30) is the rate in force on the next day.
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  bulletin_date date NOT NULL,
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  forex_buying numeric(14,6) CHECK (forex_buying > 0),
  forex_selling numeric(14,6) CHECK (forex_selling > 0),
  banknote_buying numeric(14,6) CHECK (banknote_buying > 0),
  banknote_selling numeric(14,6) CHECK (banknote_selling > 0),
  bulletin_no text,
  source text NOT NULL DEFAULT 'TCMB',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bulletin_date, currency)
);
CREATE INDEX IF NOT EXISTS exchange_rates_currency_idx ON public.exchange_rates (currency, bulletin_date DESC);
