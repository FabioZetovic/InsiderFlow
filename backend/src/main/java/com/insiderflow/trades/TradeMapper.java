package com.insiderflow.trades;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Pure, side-effect-free parsing/normalization helpers used by ingestion. Kept separate from
 * {@link TradeIngestionService} so the fiddly bits (date parsing, amount ranges, ticker
 * recovery, asset classification, dedup keys) are unit-testable without Mongo or Spring.
 */
public final class TradeMapper {

    private static final DateTimeFormatter US_DATE = DateTimeFormatter.ofPattern("MM/dd/yyyy");
    private static final Pattern TRAILING_TICKER = Pattern.compile("\\(([A-Z][A-Z0-9.]{0,5})\\)\\s*$");
    private static final Pattern MONEY = Pattern.compile("\\$?\\s*([0-9][0-9,]*)");

    /** Non-equity asset categories, matched against the filing's asset_type / description text. */
    public static final String FIXED_INCOME = "Fixed Income";
    public static final String FUND = "Fund";
    public static final String CRYPTO = "Crypto";
    public static final String OTHER_ASSET = "Other Assets";

    private TradeMapper() {
    }

    public static String normalizeType(String raw) {
        if (raw == null) {
            return null;
        }
        String lower = raw.toLowerCase();
        if (lower.contains("purchase")) {
            return "BUY";
        }
        if (lower.contains("sale")) {
            return "SELL";
        }
        if (lower.contains("exchange")) {
            return "EXCHANGE";
        }
        return null;
    }

    public static String normalizeTicker(String raw) {
        if (raw == null) {
            return null;
        }
        String t = raw.trim().toUpperCase();
        if (t.isEmpty() || t.equals("--") || t.equals("N/A") || t.equals("NONE") || t.equals("-")) {
            return null;
        }
        return t;
    }

    /**
     * Recovers a ticker embedded in a description like "Citigroup New Inc (C)" for stock-type
     * assets when the ticker column itself is blank.
     */
    public static String recoverTicker(String description, String assetType) {
        if (description == null) {
            return null;
        }
        boolean stockLike = assetType == null || assetType.toLowerCase().contains("stock");
        if (!stockLike) {
            return null;
        }
        Matcher m = TRAILING_TICKER.matcher(description);
        return m.find() ? m.group(1) : null;
    }

    public static LocalDate parseDate(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String s = raw.trim();
        try {
            return LocalDate.parse(s, US_DATE);
        } catch (Exception ignored) {
            // fall through to ISO
        }
        try {
            return LocalDate.parse(s);
        } catch (Exception ignored) {
            return null;
        }
    }

    /** Parsed numeric bounds of an amount range; any field may be null when unparseable. */
    public record AmountBounds(Long low, Long mid, Long high) {
        static final AmountBounds EMPTY = new AmountBounds(null, null, null);
    }

    /**
     * Parses ranges like "$1,001 - $15,000", "$1,000,001 - $5,000,000", "$1,000,000 +",
     * or a single "$15,000" into numeric bounds. Midpoint is the average of the two ends
     * (or the single value / the open-ended lower bound).
     */
    public static AmountBounds parseAmount(String raw) {
        if (raw == null || raw.isBlank()) {
            return AmountBounds.EMPTY;
        }
        Matcher m = MONEY.matcher(raw);
        Long first = null;
        Long second = null;
        while (m.find()) {
            long value = Long.parseLong(m.group(1).replace(",", ""));
            if (first == null) {
                first = value;
            } else if (second == null) {
                second = value;
                break;
            }
        }
        if (first == null) {
            return AmountBounds.EMPTY;
        }
        if (second == null) {
            // Single value, or open-ended "$1,000,000 +": mid == low == high (best estimate).
            return new AmountBounds(first, first, first);
        }
        long mid = Math.floorDiv(first + second, 2);
        return new AmountBounds(first, mid, second);
    }

    /**
     * Classifies an asset into a coarse category using the filing's asset_type first, then the
     * description text. Returns null for plain equities (so the GICS sector resolver handles
     * those) — a non-null result means "this isn't a normal stock, label it directly".
     */
    public static String classifyNonEquity(String assetType, String description) {
        String hay = ((assetType == null ? "" : assetType) + " " + (description == null ? "" : description))
                .toLowerCase();
        if (hay.isBlank()) {
            return null;
        }
        if (containsAny(hay, "municipal", "corporate bond", "treasury", " note", "notes ", "debenture",
                "bond", "bill", "fixed income", "certificate of deposit")) {
            return FIXED_INCOME;
        }
        if (containsAny(hay, "crypto", "bitcoin", "ethereum", "coinbase wallet")) {
            return CRYPTO;
        }
        if (containsAny(hay, "mutual fund", "index fund", "money market", " etf", "etf ", "exchange traded",
                "exchange-traded", "fund")) {
            return FUND;
        }
        if (assetType != null) {
            String at = assetType.toLowerCase();
            // Named non-equity asset types win over the "stock" substring: a "Stock Option"
            // is an option, not an equity.
            if (containsAny(at, "option", "real estate", "reit", "annuity", "insurance",
                    "commodity", "hedge", "private equity", "partnership", "trust")) {
                return OTHER_ASSET;
            }
            // asset_type explicitly says stock/equity -> let GICS resolution handle it
            if (at.contains("stock") || at.contains("equity") || at.contains("common")) {
                return null;
            }
        }
        return null;
    }

    /**
     * A transaction date is suspicious if it lands after the disclosure date (impossible —
     * you can't disclose a trade before making it) or is absurdly far in the future.
     */
    public static boolean isSuspiciousDate(LocalDate transactionDate, LocalDate disclosureDate, LocalDate today) {
        if (transactionDate == null) {
            return false;
        }
        if (disclosureDate != null && transactionDate.isAfter(disclosureDate)) {
            return true;
        }
        return today != null && transactionDate.isAfter(today.plusDays(7));
    }

    /**
     * The STOCK Act requires disclosure within 45 days of the transaction. Suspicious-dated
     * rows are excluded (a typo'd transaction date would produce a bogus lag).
     */
    public static boolean isLateDisclosure(LocalDate transactionDate, LocalDate disclosureDate) {
        if (transactionDate == null || disclosureDate == null || transactionDate.isAfter(disclosureDate)) {
            return false;
        }
        return java.time.temporal.ChronoUnit.DAYS.between(transactionDate, disclosureDate) > 45;
    }

    public static String dedupKey(String member, String ticker, LocalDate transactionDate,
                                  String amountRange, String type) {
        return String.join("|",
                member == null ? "" : member,
                ticker == null ? "" : ticker,
                transactionDate == null ? "" : transactionDate.toString(),
                amountRange == null ? "" : amountRange,
                type == null ? "" : type);
    }

    private static boolean containsAny(String haystack, String... needles) {
        for (String n : needles) {
            if (haystack.contains(n)) {
                return true;
            }
        }
        return false;
    }
}
