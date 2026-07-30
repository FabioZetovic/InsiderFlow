package com.insiderflow.trades;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface TickerRepository extends MongoRepository<TickerInfo, String> {
}
