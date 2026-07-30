package com.insiderflow.corporate;

import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/corporate")
public class CorporateController {

    private final InsiderTradeRepository repository;
    private final MongoTemplate mongoTemplate;

    public CorporateController(InsiderTradeRepository repository, MongoTemplate mongoTemplate) {
        this.repository = repository;
        this.mongoTemplate = mongoTemplate;
    }

    public record PagedInsiders(List<InsiderTrade> content, int page, int size, long totalElements, int totalPages) {
    }

    /** Recent corporate-insider (Form 4) trades, optionally filtered by ticker or type. */
    @GetMapping
    public PagedInsiders list(@RequestParam(required = false) String ticker,
                              @RequestParam(required = false) String type,
                              @RequestParam(defaultValue = "0") int page,
                              @RequestParam(defaultValue = "50") int size) {
        int safeSize = Math.min(Math.max(size, 1), 200);
        int safePage = Math.max(page, 0);
        Criteria criteria = new Criteria();
        if (ticker != null && !ticker.isBlank()) {
            criteria = criteria.and("ticker").is(ticker.toUpperCase());
        }
        if (type != null && !type.isBlank()) {
            criteria = criteria.and("transactionType").is(type.toUpperCase());
        }
        Query query = new Query(criteria);
        long total = mongoTemplate.count(query, InsiderTrade.class);
        query.with(Sort.by(Sort.Direction.DESC, "transactionDate"));
        query.skip((long) safePage * safeSize).limit(safeSize);
        List<InsiderTrade> content = mongoTemplate.find(query, InsiderTrade.class);
        int totalPages = safeSize == 0 ? 0 : (int) Math.ceil((double) total / safeSize);
        return new PagedInsiders(content, safePage, safeSize, total, totalPages);
    }

    private static final java.util.regex.Pattern VALID_TICKER = java.util.regex.Pattern.compile("^[A-Z0-9.\\-]{1,10}$");

    /** Corporate insider trades for one ticker (used on the ticker detail page). */
    @GetMapping("/ticker/{ticker}")
    public List<InsiderTrade> forTicker(@PathVariable String ticker) {
        String t = ticker == null ? "" : ticker.trim().toUpperCase();
        if (!VALID_TICKER.matcher(t).matches()) {
            return List.of();
        }
        return repository.findTop50ByTickerOrderByTransactionDateDesc(t);
    }
}
