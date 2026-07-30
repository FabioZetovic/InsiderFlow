package com.insiderflow.watchlist;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface WatchlistRepository extends MongoRepository<Watchlist, String> {
}
