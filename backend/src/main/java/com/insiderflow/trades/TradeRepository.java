package com.insiderflow.trades;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface TradeRepository extends MongoRepository<Trade, String> {

    long countByChamber(String chamber);
}
