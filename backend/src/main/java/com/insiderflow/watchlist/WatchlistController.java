package com.insiderflow.watchlist;

import com.insiderflow.auth.User;
import com.insiderflow.common.ApiException;
import com.insiderflow.trades.Trade;
import com.insiderflow.trades.TradeDtos;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Per-user watchlist of members and tickers (F6), and the "My feed" endpoint that returns recent
 * trades matching anything on the watchlist. All endpoints require an authenticated user.
 */
@RestController
@RequestMapping("/api/watchlist")
public class WatchlistController {

    private final WatchlistRepository repository;
    private final MongoTemplate mongoTemplate;

    public WatchlistController(WatchlistRepository repository, MongoTemplate mongoTemplate) {
        this.repository = repository;
        this.mongoTemplate = mongoTemplate;
    }

    public record WatchlistDto(List<String> members, List<String> tickers) {
    }

    public record ToggleRequest(String type, String value) {
    }

    private Watchlist forUser(User user) {
        if (user == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return repository.findById(user.getId()).orElseGet(() -> new Watchlist(user.getId()));
    }

    @GetMapping
    public WatchlistDto get(@AuthenticationPrincipal User user) {
        Watchlist w = forUser(user);
        return new WatchlistDto(List.copyOf(w.getMembers()), List.copyOf(w.getTickers()));
    }

    /** Toggles a member or ticker on/off the watchlist; returns the updated lists. */
    @PostMapping("/toggle")
    public WatchlistDto toggle(@AuthenticationPrincipal User user, @RequestBody ToggleRequest req) {
        Watchlist w = forUser(user);
        if (req == null || req.value() == null || req.value().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "value is required");
        }
        String value = req.value().trim();
        var set = "ticker".equalsIgnoreCase(req.type()) ? w.getTickers() : w.getMembers();
        if (!set.remove("ticker".equalsIgnoreCase(req.type()) ? value.toUpperCase() : value)
                && !set.remove(value)) {
            set.add("ticker".equalsIgnoreCase(req.type()) ? value.toUpperCase() : value);
        }
        repository.save(w);
        return new WatchlistDto(List.copyOf(w.getMembers()), List.copyOf(w.getTickers()));
    }

    /** Recent trades by any watched member or on any watched ticker, newest first. */
    @GetMapping("/feed")
    public TradeDtos.PagedResponse<Trade> feed(@AuthenticationPrincipal User user,
                                               @RequestParam(defaultValue = "0") int page,
                                               @RequestParam(defaultValue = "50") int size) {
        Watchlist w = forUser(user);
        if (w.getMembers().isEmpty() && w.getTickers().isEmpty()) {
            return new TradeDtos.PagedResponse<>(List.of(), 0, size, 0, 0);
        }
        int safeSize = Math.min(Math.max(size, 1), 200);
        int safePage = Math.max(page, 0);

        Criteria criteria = new Criteria().orOperator(
                Criteria.where("member").in(w.getMembers()),
                Criteria.where("ticker").in(w.getTickers()));
        Query query = new Query(criteria);
        long total = mongoTemplate.count(query, Trade.class);
        query.with(Sort.by(Sort.Direction.ASC, "suspiciousDate").and(Sort.by(Sort.Direction.DESC, "transactionDate")));
        query.skip((long) safePage * safeSize).limit(safeSize);
        List<Trade> content = mongoTemplate.find(query, Trade.class);
        int totalPages = safeSize == 0 ? 0 : (int) Math.ceil((double) total / safeSize);
        return new TradeDtos.PagedResponse<>(content, safePage, safeSize, total, totalPages);
    }
}
