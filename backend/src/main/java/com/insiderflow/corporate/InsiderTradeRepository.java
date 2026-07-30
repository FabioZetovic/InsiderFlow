package com.insiderflow.corporate;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface InsiderTradeRepository extends MongoRepository<InsiderTrade, String> {

    List<InsiderTrade> findTop50ByTickerOrderByTransactionDateDesc(String ticker);
}
