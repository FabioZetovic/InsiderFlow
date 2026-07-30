package com.insiderflow.market;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDate;
import java.util.List;

public interface EarningsRepository extends MongoRepository<EarningsEntry, String> {

    List<EarningsEntry> findByDateBetweenOrderByDateAsc(LocalDate from, LocalDate to);
}
